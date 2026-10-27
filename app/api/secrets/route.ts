import { NextRequest, NextResponse } from 'next/server';
import { db, secrets, secretValues, environments } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { encryptForProject, decryptForProject } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const environmentSlug = searchParams.get('environment') || 'dev';

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Find the environment
    const [env] = await db
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.projectId, projectId),
          eq(environments.slug, environmentSlug)
        )
      )
      .limit(1);

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Query all secrets for this project
    const allSecrets = await db
      .select()
      .from(secrets)
      .where(eq(secrets.projectId, projectId));

    // For each secret, query value in this environment
    const result = await Promise.all(
      allSecrets.map(async (s) => {
        const [val] = await db
          .select()
          .from(secretValues)
          .where(
            and(
              eq(secretValues.secretId, s.id),
              eq(secretValues.environmentId, env.id)
            )
          )
          .limit(1);

        let plaintext = '';
        if (val) {
          try {
            plaintext = decryptForProject(projectId, {
              ciphertext: val.ciphertext,
              iv: val.iv,
              authTag: val.authTag,
            });
          } catch (e) {
            console.error(`Failed to decrypt ${s.name}:`, e);
          }
        }

        return {
          id: s.id,
          name: s.name,
          comment: s.comment,
          value: plaintext,
          version: val?.version || 1,
          updatedAt: val?.updatedAt || s.updatedAt,
        };
      })
    );

    return NextResponse.json({ secrets: result, environment: env });
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

    // Find environment
    const [env] = await db
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.projectId, projectId),
          eq(environments.slug, environmentSlug)
        )
      )
      .limit(1);

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Find or create secret
    let [secretRecord] = await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.projectId, projectId),
          eq(secrets.name, name)
        )
      )
      .limit(1);

    if (!secretRecord) {
      [secretRecord] = await db
        .insert(secrets)
        .values({
          projectId,
          name,
          comment: comment || null,
        })
        .returning();
    } else if (comment !== undefined) {
      await db
        .update(secrets)
        .set({ comment, updatedAt: new Date() })
        .where(eq(secrets.id, secretRecord.id));
    }

    // Encrypt the value
    const encrypted = encryptForProject(projectId, value);

    // Upsert secret value
    const [existingVal] = await db
      .select()
      .from(secretValues)
      .where(
        and(
          eq(secretValues.secretId, secretRecord.id),
          eq(secretValues.environmentId, env.id)
        )
      )
      .limit(1);

    if (existingVal) {
      await db
        .update(secretValues)
        .set({
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          version: existingVal.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(secretValues.id, existingVal.id));
    } else {
      await db.insert(secretValues).values({
        secretId: secretRecord.id,
        environmentId: env.id,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        version: 1,
      });
    }

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

    await db.delete(secrets).where(eq(secrets.id, secretId));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete secret:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
