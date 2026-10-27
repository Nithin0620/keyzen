import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { dispatchWebhooks } from '@/lib/webhooks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { historyId, secretId, projectId, environmentSlug } = body;

    if (!historyId || !secretId || !projectId) {
      return NextResponse.json({ error: 'historyId, secretId, projectId required' }, { status: 400 });
    }

    const [env] = await sql`
      SELECT id, slug FROM environments 
      WHERE project_id = ${projectId} AND slug = ${environmentSlug || 'dev'} 
      LIMIT 1;
    `;

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Get historical record
    const [historical] = await sql`
      SELECT ciphertext, iv, auth_tag, version
      FROM secret_history
      WHERE id = ${historyId} AND secret_id = ${secretId};
    `;

    if (!historical) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Current record
    const [current] = await sql`
      SELECT ciphertext, iv, auth_tag, version
      FROM secret_values
      WHERE secret_id = ${secretId} AND environment_id = ${env.id};
    `;

    if (current) {
      // Archive current before rolling back
      await sql`
        INSERT INTO secret_history (secret_id, environment_id, version, ciphertext, iv, auth_tag, changed_by)
        VALUES (${secretId}, ${env.id}, ${current.version}, ${current.ciphertext}, ${current.iv}, ${current.auth_tag}, 'user-rollback');
      `;

      // Update with historical version
      await sql`
        UPDATE secret_values
        SET 
          ciphertext = ${historical.ciphertext},
          iv = ${historical.iv},
          auth_tag = ${historical.auth_tag},
          version = ${current.version + 1},
          updated_at = NOW()
        WHERE secret_id = ${secretId} AND environment_id = ${env.id};
      `;
    }

    // Get secret name for audit
    const [secretInfo] = await sql`SELECT name FROM secrets WHERE id = ${secretId} LIMIT 1;`;

    // Log audit
    const [proj] = await sql`SELECT org_id as "orgId" FROM projects WHERE id = ${projectId} LIMIT 1;`;
    sql`
      INSERT INTO audit_logs (org_id, project_id, actor_type, actor_id, actor_name, action, metadata)
      VALUES (
        ${proj?.orgId || projectId},
        ${projectId},
        'USER',
        'dashboard-user',
        'Dashboard User',
        'SECRET_ROLLBACK',
        ${JSON.stringify({ secretName: secretInfo?.name, rolledBackToVersion: historical.version, environment: env.slug })}
      );
    `.catch(() => {});

    dispatchWebhooks(projectId, 'SECRET_UPDATE', {
      action: 'ROLLED_BACK',
      secretName: secretInfo?.name,
      environment: env.slug,
      restoredVersion: historical.version,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: `Rolled back to version ${historical.version}` });
  } catch (err: any) {
    console.error('Rollback error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
