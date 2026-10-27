import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetPlan = 'PRO' } = body;

    let [org] = await sql`SELECT id FROM organizations LIMIT 1;`;
    if (!org) {
      [org] = await sql`
        INSERT INTO organizations (name, slug)
        VALUES ('Default Organization', 'default-org')
        RETURNING id;
      `;
    }

    // Upsert subscription
    await sql`
      INSERT INTO subscriptions (org_id, plan, status, current_period_end)
      VALUES (${org.id}, ${targetPlan}, 'active', NOW() + INTERVAL '1 month')
      ON CONFLICT (org_id)
      DO UPDATE SET plan = ${targetPlan}, status = 'active', current_period_end = NOW() + INTERVAL '1 month';
    `;

    return NextResponse.json({
      success: true,
      plan: targetPlan,
      message: `Successfully upgraded organization to ${targetPlan} plan!`,
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
