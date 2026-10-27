import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { encryptForProject, decryptForProject } from '@/lib/crypto';
import { dispatchWebhooks } from '@/lib/webhooks';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const environmentSlug = searchParams.get('environment') || 'dev';

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT 
        e.id as "envId",
        e.name as "envName",
        e.slug as "envSlug",
        s.id,
        s.name,
        s.comment,
        s.updated_at as "updatedAt",
        sv.ciphertext,
        sv.iv,
        sv.auth_tag as "authTag",
        sv.version
      FROM environments e
      LEFT JOIN secrets s ON s.project_id = e.project_id
      LEFT JOIN secret_values sv ON sv.secret_id = s.id AND sv.environment_id = e.id
      WHERE e.project_id = ${projectId} AND e.slug = ${environmentSlug}
      ORDER BY s.name ASC;
    `;

    if (rows.length === 0) {
      const [env] = await sql`
        SELECT id, name, slug FROM environments 
        WHERE project_id = ${projectId} AND slug = ${environmentSlug} 
        LIMIT 1;
      `;
      if (!env) {
        return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
      }
      return NextResponse.json({ secrets: [], environment: env });
    }

    const envInfo = {
      id: rows[0].envId,
      name: rows[0].envName,
      slug: rows[0].envSlug,
    };

    if (!rows[0].id) {
      return NextResponse.json({ secrets: [], environment: envInfo });
    }

    const decryptedSecrets = rows.map((row: any) => {
      let plaintext = '';
      if (row.ciphertext && row.iv && row.authTag) {
        try {
          plaintext = decryptForProject(projectId, {
            ciphertext: row.ciphertext,
            iv: row.iv,
            authTag: row.authTag,
          });
        } catch (e) {
          console.error(`Failed to decrypt ${row.name}:`, e);
        }
      }

      return {
        id: row.id,
        name: row.name,
        comment: row.comment,
        value: plaintext,
        version: row.version || 1,
        updatedAt: row.updatedAt,
      };
    });

    return NextResponse.json({ secrets: decryptedSecrets, environment: envInfo });
  } catch (err: any) {
    console.error('Failed to get secrets:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, environmentSlug = 'dev', name, value, comment } = body;

    if (!projectId || !name || value === undefined) {
      return NextResponse.json(
        { error: 'projectId, name, and value are required' },
        { status: 400 }
      );
    }

    const encrypted = encryptForProject(projectId, value);

    const [env] = await sql`
      SELECT id FROM environments 
      WHERE project_id = ${projectId} AND slug = ${environmentSlug} 
      LIMIT 1;
    `;

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const [secretRecord] = await sql`
      INSERT INTO secrets (project_id, name, comment)
      VALUES (${projectId}, ${name}, ${comment || null})
      ON CONFLICT (project_id, name)
      DO UPDATE SET comment = COALESCE(EXCLUDED.comment, secrets.comment), updated_at = NOW()
      RETURNING id, name;
    `;

    // Check if an existing value is present, to archive before updating
    const [existingVal] = await sql`
      SELECT ciphertext, iv, auth_tag, version 
      FROM secret_values 
      WHERE secret_id = ${secretRecord.id} AND environment_id = ${env.id}
      LIMIT 1;
    `;

    if (existingVal) {
      // Archive previous version to secret_history
      await sql`
        INSERT INTO secret_history (secret_id, environment_id, version, ciphertext, iv, auth_tag, changed_by)
        VALUES (${secretRecord.id}, ${env.id}, ${existingVal.version}, ${existingVal.ciphertext}, ${existingVal.iv}, ${existingVal.auth_tag}, 'user');
      `;

      // Update to new version
      await sql`
        UPDATE secret_values 
        SET 
          ciphertext = ${encrypted.ciphertext},
          iv = ${encrypted.iv},
          auth_tag = ${encrypted.authTag},
          version = ${existingVal.version + 1},
          updated_at = NOW()
        WHERE secret_id = ${secretRecord.id} AND environment_id = ${env.id};
      `;
    } else {
      await sql`
        INSERT INTO secret_values (secret_id, environment_id, ciphertext, iv, auth_tag, version)
        VALUES (${secretRecord.id}, ${env.id}, ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.authTag}, 1);
      `;
    }

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
        ${existingVal ? 'SECRET_UPDATE' : 'SECRET_CREATE'},
        ${JSON.stringify({ name, environment: environmentSlug })}
      );
    `.catch(() => {});

    // Dispatch Webhooks
    dispatchWebhooks(projectId, 'SECRET_UPDATE', {
      secretName: name,
      environment: environmentSlug,
      action: existingVal ? 'UPDATED' : 'CREATED',
    }).catch(() => {});

    return NextResponse.json({ success: true, secret: secretRecord });
  } catch (err: any) {
    console.error('Failed to save secret:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secretId = searchParams.get('secretId');

    if (!secretId) {
      return NextResponse.json({ error: 'secretId is required' }, { status: 400 });
    }

    await sql`DELETE FROM secrets WHERE id = ${secretId};`;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete secret:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
