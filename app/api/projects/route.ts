import { NextRequest, NextResponse } from 'next/server';
import { sql, db, organizations, projects, environments } from '@/lib/db';

export async function GET() {
  try {
    // Single consolidated query with JSON aggregation: eliminates N+1 queries completely
    const enrichedProjects = await sql`
      SELECT 
        p.id,
        p.org_id as "orgId",
        p.name,
        p.slug,
        p.description,
        p.created_at as "createdAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'name', e.name,
              'slug', e.slug,
              'secretCount', COALESCE(sc.cnt, 0)
            ) ORDER BY e.slug
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) AS environments
      FROM projects p
      LEFT JOIN environments e ON e.project_id = p.id
      LEFT JOIN (
        SELECT environment_id, count(*)::int AS cnt
        FROM secret_values
        GROUP BY environment_id
      ) sc ON sc.environment_id = e.id
      GROUP BY p.id
      ORDER BY p.created_at DESC;
    `;

    return NextResponse.json({ projects: enrichedProjects });
  } catch (err: any) {
    console.error('Failed to list projects:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const slug = body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Get default organization or create one if none exists
    let [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      [org] = await db
        .insert(organizations)
        .values({
          name: 'Default Organization',
          slug: 'default-org',
        })
        .returning();
    }

    // Insert project
    const [newProject] = await db
      .insert(projects)
      .values({
        orgId: org.id,
        name,
        slug,
        description: description || null,
      })
      .returning();

    // Create default environments: dev, staging, prod in a single multi-row INSERT
    await db.insert(environments).values([
      { projectId: newProject.id, name: 'Development', slug: 'dev' },
      { projectId: newProject.id, name: 'Staging', slug: 'staging' },
      { projectId: newProject.id, name: 'Production', slug: 'prod' },
    ]);

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (err: any) {
    console.error('Failed to create project:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
