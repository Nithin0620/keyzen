import { NextRequest, NextResponse } from 'next/server';
import { db, serviceTokens, environments } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { generateServiceToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const tokens = await db
      .select({
        id: serviceTokens.id,
        name: serviceTokens.name,
        tokenPrefix: serviceTokens.tokenPrefix,
        environmentId: serviceTokens.environmentId,
        environmentSlug: environments.slug,
        environmentName: environments.name,
        createdAt: serviceTokens.createdAt,
        lastUsedAt: serviceTokens.lastUsedAt,
        expiresAt: serviceTokens.expiresAt,
      })
      .from(serviceTokens)
      .innerJoin(environments, eq(serviceTokens.environmentId, environments.id))
      .where(eq(serviceTokens.projectId, projectId));

    return NextResponse.json({ tokens });
  } catch (err: any) {
    console.error('Failed to get tokens:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, environmentSlug = 'prod', name = 'CLI Token' } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

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

    const { token, hash } = generateServiceToken(environmentSlug);
    const prefix = token.slice(0, 16) + '...';

    const [created] = await db
      .insert(serviceTokens)
      .values({
        projectId,
        environmentId: env.id,
        name,
        tokenHash: hash,
        tokenPrefix: prefix,
        createdBy: 'user',
      })
      .returning();

    // Plaintext token is only returned on creation!
    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        token, // Plaintext returned once
        prefix,
        environment: env.slug,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Failed to create token:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.delete(serviceTokens).where(eq(serviceTokens.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to revoke token:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
