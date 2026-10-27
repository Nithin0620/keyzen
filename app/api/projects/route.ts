import { NextRequest, NextResponse } from 'next/server';
import { db, organizations, projects, environments, secrets, secretValues } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Fetch all projects
    const allProjects = await db.select().from(projects);

    // For each project, fetch its environments and secret count
    const enrichedProjects = await Promise.all(
      allProjects.map(async (project) => {
        const envs = await db
          .select()
          .from(environments)
          .where(eq(environments.projectId, project.id));

        const enrichedEnvs = await Promise.all(
          envs.map(async (env) => {
            const [valCount] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(secretValues)
              .where(eq(secretValues.environmentId, env.id));

            return {
              id: env.id,
              name: env.name,
              slug: env.slug,
              secretCount: valCount?.count || 0,
            };
          })
        );

        return {
          ...project,
          environments: enrichedEnvs,
        };
      })
    );

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

    // Create default environments: dev, staging, prod
    const defaultEnvs = [
      { name: 'Development', slug: 'dev' },
      { name: 'Staging', slug: 'staging' },
      { name: 'Production', slug: 'prod' },
    ];

    await Promise.all(
      defaultEnvs.map((e) =>
        db.insert(environments).values({
          projectId: newProject.id,
          name: e.name,
          slug: e.slug,
        })
      )
    );

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (err: any) {
    console.error('Failed to create project:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
