import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashToken, decryptForProject } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Bearer token required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const tokenHash = hashToken(token);

    // Single consolidated query: Auth check + Environment check + Secrets fetch in 1 roundtrip
    const rows = await sql`
      SELECT 
        st.id as "tokenId",
        st.name as "tokenName",
        st.project_id as "projectId",
        st.expires_at as "expiresAt",
        e.slug as "envSlug",
        s.name as "secretName",
        sv.ciphertext,
        sv.iv,
        sv.auth_tag as "authTag"
      FROM service_tokens st
      INNER JOIN environments e ON e.id = st.environment_id
      LEFT JOIN secrets s ON s.project_id = st.project_id
      LEFT JOIN secret_values sv ON sv.secret_id = s.id AND sv.environment_id = st.environment_id
      WHERE st.token_hash = ${tokenHash};
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid service token' },
        { status: 401 }
      );
    }

    const first = rows[0];

    if (first.expiresAt && new Date(first.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Service token has expired' },
        { status: 401 }
      );
    }

    // Fire-and-forget: update lastUsedAt without blocking the response
    sql`UPDATE service_tokens SET last_used_at = NOW() WHERE id = ${first.tokenId}`.catch(() => {});

    // Decrypt all resolved secrets in-memory
    const resolved: Record<string, string> = {};
    for (const row of rows) {
      if (row.secretName && row.ciphertext && row.iv && row.authTag) {
        try {
          const decrypted = decryptForProject(first.projectId, {
            ciphertext: row.ciphertext,
            iv: row.iv,
            authTag: row.authTag,
          });
          resolved[row.secretName] = decrypted;
        } catch (err) {
          console.error(`Failed to decrypt secret ${row.secretName}:`, err);
        }
      }
    }

    // Fire-and-forget: audit log insertion
    sql`
      INSERT INTO audit_logs (org_id, project_id, actor_type, actor_id, actor_name, action, metadata, ip_address, user_agent)
      VALUES (
        ${first.projectId}, 
        ${first.projectId}, 
        'SERVICE_TOKEN', 
        ${first.tokenId}, 
        ${first.tokenName}, 
        'SECRET_RESOLVE_BATCH', 
        ${JSON.stringify({ environment: first.envSlug, count: Object.keys(resolved).length })},
        ${req.headers.get('x-forwarded-for') || '127.0.0.1'},
        ${req.headers.get('user-agent') || 'Keyzen-Client'}
      )
    `.catch(() => {});

    return NextResponse.json({
      environment: first.envSlug,
      count: Object.keys(resolved).length,
      secrets: resolved,
    });
  } catch (err: any) {
    console.error('Resolve error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}
