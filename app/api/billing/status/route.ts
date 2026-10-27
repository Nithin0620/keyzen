import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let [org] = await sql`SELECT id, name FROM organizations LIMIT 1;`;
    if (!org) {
      return NextResponse.json({
        plan: 'FREE',
        projectsCount: 0,
        maxProjects: 3,
        secretsCount: 0,
        maxSecrets: 25,
      });
    }

    const [sub] = await sql`
      SELECT plan, status, current_period_end as "currentPeriodEnd"
      FROM subscriptions
      WHERE org_id = ${org.id}
      LIMIT 1;
    `;

    const [projCount] = await sql`SELECT count(*)::int as count FROM projects WHERE org_id = ${org.id};`;
    const [secCount] = await sql`
      SELECT count(*)::int as count 
      FROM secrets s
      INNER JOIN projects p ON p.id = s.project_id
      WHERE p.org_id = ${org.id};
    `;

    const plan = sub?.plan || 'FREE';
    const isPro = plan === 'PRO' || plan === 'ENTERPRISE';

    return NextResponse.json({
      plan,
      status: sub?.status || 'active',
      currentPeriodEnd: sub?.currentPeriodEnd,
      projectsCount: projCount?.count || 0,
      maxProjects: isPro ? 1000 : 3,
      secretsCount: secCount?.count || 0,
      maxSecrets: isPro ? 10000 : 25,
    });
  } catch (err: any) {
    console.error('Billing status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
