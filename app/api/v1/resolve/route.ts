import { NextRequest, NextResponse } from 'next/server';
import { db, serviceTokens, environments, secrets, secretValues, auditLogs } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
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

    // Find service token
    const [foundToken] = await db
      .select({
        id: serviceTokens.id,
        name: serviceTokens.name,
        projectId: serviceTokens.projectId,
        environmentId: serviceTokens.environmentId,
        environmentSlug: environments.slug,
        expiresAt: serviceTokens.expiresAt,
      })
      .from(serviceTokens)
      .innerJoin(environments, eq(serviceTokens.environmentId, environments.id))
      .where(eq(serviceTokens.tokenHash, tokenHash))
      .limit(1);

    if (!foundToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid service token' },
        { status: 401 }
      );
    }

    if (foundToken.expiresAt && new Date(foundToken.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Service token has expired' },
        { status: 401 }
      );
    }

    // Update lastUsedAt asynchronously
    db.update(serviceTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(serviceTokens.id, foundToken.id))
      .execute()
      .catch(() => {});

    // Query secrets for this environment
    const rows = await db
      .select({
        name: secrets.name,
        ciphertext: secretValues.ciphertext,
        iv: secretValues.iv,
        authTag: secretValues.authTag,
      })
      .from(secrets)
      .innerJoin(
        secretValues,
        and(
          eq(secretValues.secretId, secrets.id),
          eq(secretValues.environmentId, foundToken.environmentId)
        )
      )
      .where(eq(secrets.projectId, foundToken.projectId));

    const resolved: Record<string, string> = {};
    for (const row of rows) {
      try {
        const decrypted = decryptForProject(foundToken.projectId, {
          ciphertext: row.ciphertext,
          iv: row.iv,
          authTag: row.authTag,
        });
        resolved[row.name] = decrypted;
      } catch (err) {
        console.error(`Failed to decrypt secret ${row.name}:`, err);
      }
    }

    // Insert audit log
    db.insert(auditLogs)
      .values({
        orgId: foundToken.projectId, // fallback if orgId not joined
        projectId: foundToken.projectId,
        actorType: 'SERVICE_TOKEN',
        actorId: foundToken.id,
        actorName: foundToken.name,
        action: 'SECRET_RESOLVE_BATCH',
        metadata: {
          environment: foundToken.environmentSlug,
          count: Object.keys(resolved).length,
        },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Keyzen-Client',
      })
      .execute()
      .catch(() => {});

    return NextResponse.json({
      environment: foundToken.environmentSlug,
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
