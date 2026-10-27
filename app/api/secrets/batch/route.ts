import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { encryptForProject } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, environmentSlug = 'dev', secrets, rawEnv } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Resolve environment and organization ID
    const [env] = await sql`
      SELECT id, slug FROM environments 
      WHERE project_id = ${projectId} AND slug = ${environmentSlug} 
      LIMIT 1;
    `;

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const [proj] = await sql`SELECT org_id as "orgId" FROM projects WHERE id = ${projectId} LIMIT 1;`;
    const orgId = proj?.orgId;

    let itemsToImport: Array<{ name: string; value: string; comment?: string }> = [];

    // Parse rawEnv string if provided
    if (typeof rawEnv === 'string' && rawEnv.trim()) {
      const lines = rawEnv.split(/\r?\n/);
      let currentComment = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentComment = '';
          continue;
        }

        // Comment line
        if (trimmed.startsWith('#')) {
          currentComment = trimmed.replace(/^#+\s*/, '');
          continue;
        }

        const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
          const rawKey = match[1].trim().toUpperCase();
          let rawVal = match[2].trim();

          // Strip wrapping quotes
          if (
            (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
            (rawVal.startsWith("'") && rawVal.endsWith("'"))
          ) {
            rawVal = rawVal.slice(1, -1);
          }

          itemsToImport.push({
            name: rawKey,
            value: rawVal,
            comment: currentComment || undefined,
          });
          currentComment = '';
        }
      }
    } else if (Array.isArray(secrets)) {
      itemsToImport = secrets
        .filter((s) => s && s.name && s.value !== undefined)
        .map((s) => ({
          name: String(s.name).trim().toUpperCase(),
          value: String(s.value),
          comment: s.comment,
        }));
    }

    if (itemsToImport.length === 0) {
      return NextResponse.json({ error: 'No valid key-value pairs provided' }, { status: 400 });
    }

    // Process each secret in a transaction
    await sql.begin(async (tx) => {
      for (const item of itemsToImport) {
        // Upsert secret
        const [secretRecord] = await tx`
          INSERT INTO secrets (project_id, name, comment)
          VALUES (${projectId}, ${item.name}, ${item.comment || null})
          ON CONFLICT (project_id, name)
          DO UPDATE SET 
            comment = COALESCE(EXCLUDED.comment, secrets.comment),
            updated_at = NOW()
          RETURNING id;
        `;

        // Encrypt value
        const encrypted = encryptForProject(projectId, item.value);

        // Upsert secret value
        await tx`
          INSERT INTO secret_values (secret_id, environment_id, ciphertext, iv, auth_tag, version)
          VALUES (${secretRecord.id}, ${env.id}, ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.authTag}, 1)
          ON CONFLICT (secret_id, environment_id)
          DO UPDATE SET 
            ciphertext = EXCLUDED.ciphertext,
            iv = EXCLUDED.iv,
            auth_tag = EXCLUDED.auth_tag,
            version = secret_values.version + 1,
            updated_at = NOW();
        `;
      }

      // Log audit
      await tx`
        INSERT INTO audit_logs (org_id, project_id, actor_type, actor_id, actor_name, action, metadata)
        VALUES (
          ${orgId},
          ${projectId},
          'USER',
          'dashboard-user',
          'Dashboard User',
          'SECRET_BATCH_IMPORT',
          ${JSON.stringify({ environment: env.slug, count: itemsToImport.length })}
        );
      `;
    });

    return NextResponse.json({
      success: true,
      count: itemsToImport.length,
      importedKeys: itemsToImport.map((i) => i.name),
    });
  } catch (err: any) {
    console.error('Batch import error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
