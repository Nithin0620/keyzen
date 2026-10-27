import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const webhooks = await sql`
      SELECT 
        id,
        project_id as "projectId",
        url,
        platform,
        events,
        is_active as "isActive",
        created_at as "createdAt"
      FROM webhooks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC;
    `;

    return NextResponse.json({ webhooks });
  } catch (err: any) {
    console.error('Webhooks fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, url, platform = 'GENERIC', events = ['SECRET_UPDATE', 'TOKEN_REVOKE'] } = body;

    if (!projectId || !url) {
      return NextResponse.json({ error: 'projectId and url are required' }, { status: 400 });
    }

    // Auto-detect platform from URL if generic
    let detectedPlatform = platform;
    if (url.includes('hooks.slack.com')) detectedPlatform = 'SLACK';
    else if (url.includes('discord.com/api/webhooks')) detectedPlatform = 'DISCORD';

    const [created] = await sql`
      INSERT INTO webhooks (project_id, url, platform, events, is_active)
      VALUES (${projectId}, ${url.trim()}, ${detectedPlatform}, ${events}, true)
      RETURNING id, url, platform, events;
    `;

    return NextResponse.json({ success: true, webhook: created }, { status: 201 });
  } catch (err: any) {
    console.error('Create webhook error:', err);
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

    await sql`DELETE FROM webhooks WHERE id = ${id};`;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
