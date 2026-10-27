import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateServiceToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const tokens = await sql`
      SELECT 
        st.id,
        st.name,
        st.token_prefix as "tokenPrefix",
        st.environment_id as "environmentId",
        e.slug as "environmentSlug",
        e.name as "environmentName",
        st.created_at as "createdAt",
        st.last_used_at as "lastUsedAt",
        st.expires_at as "expiresAt"
      FROM service_tokens st
      INNER JOIN environments e ON e.id = st.environment_id
      WHERE st.project_id = ${projectId}
      ORDER BY st.created_at DESC;
    `;

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

    const [env] = await sql`
      SELECT id, slug FROM environments 
      WHERE project_id = ${projectId} AND slug = ${environmentSlug} 
      LIMIT 1;
    `;

    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const { token, hash } = generateServiceToken(environmentSlug);
    const prefix = token.slice(0, 16) + '...';

    const [created] = await sql`
      INSERT INTO service_tokens (project_id, environment_id, name, token_hash, token_prefix, created_by)
      VALUES (${projectId}, ${env.id}, ${name}, ${hash}, ${prefix}, 'user')
      RETURNING id, name;
    `;

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        token,
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

    await sql`DELETE FROM service_tokens WHERE id = ${id};`;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to revoke token:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
