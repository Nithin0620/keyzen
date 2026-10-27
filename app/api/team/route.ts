import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    // Get org for project or first org
    let orgId: string | null = null;
    if (projectId) {
      const [proj] = await sql`SELECT org_id as "orgId" FROM projects WHERE id = ${projectId} LIMIT 1;`;
      orgId = proj?.orgId;
    }

    if (!orgId) {
      const [firstOrg] = await sql`SELECT id FROM organizations LIMIT 1;`;
      orgId = firstOrg?.id;
    }

    if (!orgId) {
      return NextResponse.json({ members: [] });
    }

    const members = await sql`
      SELECT 
        id,
        user_id as "userId",
        email,
        name,
        role,
        created_at as "createdAt"
      FROM org_members
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC;
    `;

    return NextResponse.json({ members, orgId });
  } catch (err: any) {
    console.error('Team fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, role = 'MEMBER', orgId: providedOrgId, projectId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let orgId = providedOrgId;
    if (!orgId && projectId) {
      const [proj] = await sql`SELECT org_id as "orgId" FROM projects WHERE id = ${projectId} LIMIT 1;`;
      orgId = proj?.orgId;
    }
    if (!orgId) {
      const [firstOrg] = await sql`SELECT id FROM organizations LIMIT 1;`;
      orgId = firstOrg?.id;
    }

    const [member] = await sql`
      INSERT INTO org_members (org_id, user_id, email, name, role)
      VALUES (${orgId}, ${'user_' + Math.random().toString(36).substring(2, 9)}, ${email.toLowerCase().trim()}, ${name || null}, ${role})
      RETURNING id, email, name, role;
    `;

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (err: any) {
    console.error('Add member error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
    }

    await sql`DELETE FROM org_members WHERE id = ${memberId};`;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Remove member error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
