import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const logs = await sql`
      SELECT 
        id,
        project_id as "projectId",
        actor_type as "actorType",
        actor_id as "actorId",
        actor_name as "actorName",
        action,
        metadata,
        ip_address as "ipAddress",
        user_agent as "userAgent",
        created_at as "createdAt"
      FROM audit_logs
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('Audit fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
