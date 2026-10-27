import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { decryptForProject } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secretId = searchParams.get('secretId');
    const projectId = searchParams.get('projectId');
    const environmentSlug = searchParams.get('environment') || 'dev';

    if (!secretId || !projectId) {
      return NextResponse.json({ error: 'secretId and projectId are required' }, { status: 400 });
    }

    const [env] = await sql`
      SELECT id FROM environments 
      WHERE project_id = ${projectId} AND slug = ${environmentSlug} 
      LIMIT 1;
    `;

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const history = await sql`
      SELECT 
        id,
        version,
        ciphertext,
        iv,
        auth_tag as "authTag",
        changed_by as "changedBy",
        created_at as "createdAt"
      FROM secret_history
      WHERE secret_id = ${secretId} AND environment_id = ${env.id}
      ORDER BY version DESC;
    `;

    const decryptedHistory = history.map((h: any) => {
      let plaintext = '';
      try {
        plaintext = decryptForProject(projectId, {
          ciphertext: h.ciphertext,
          iv: h.iv,
          authTag: h.authTag,
        });
      } catch (e) {
        plaintext = '[Unable to decrypt]';
      }

      return {
        id: h.id,
        version: h.version,
        value: plaintext,
        changedBy: h.changedBy,
        createdAt: h.createdAt,
      };
    });

    return NextResponse.json({ history: decryptedHistory });
  } catch (err: any) {
    console.error('History fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
