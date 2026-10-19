import { createDatabaseClient } from './client';
import {
  organizations,
  orgMembers,
  projects,
  environments,
  secrets,
  secretValues,
  serviceTokens,
  auditLogs,
} from './schema';
import { deriveProjectKey, encryptSecret, generateServiceToken } from '../../crypto/src';

async function seed() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://issuepilot:localpassword@localhost:5432/keyzen';
  const masterKey = process.env.KEYZEN_MASTER_KEY || 'keyzen_dev_master_key_must_be_32_bytes_or_more_secure!';
  
  console.log(`🌱 Seeding database at ${dbUrl}...`);
  const db = createDatabaseClient(dbUrl);

  // 1. Create Organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Keyzen Dev Team',
      slug: 'keyzen-dev',
    })
    .onConflictDoNothing()
    .returning();

  const orgId = org?.id || (await db.query.organizations.findFirst({ where: (o, { eq }) => eq(o.slug, 'keyzen-dev') }))?.id;
  if (!orgId) throw new Error('Failed to find or create organization');

  // 2. Add dev-user as OWNER
  await db
    .insert(orgMembers)
    .values({
      orgId,
      userId: 'dev-user',
      email: 'developer@keyzen.dev',
      name: 'Developer',
      role: 'OWNER',
    })
    .onConflictDoNothing();

  // 3. Create Project
  const [project] = await db
    .insert(projects)
    .values({
      orgId,
      name: 'Workflow App',
      slug: 'workflow',
      description: 'Core microservices, LLM orchestration, and payments backend',
    })
    .onConflictDoNothing()
    .returning();

  const projId = project?.id || (await db.query.projects.findFirst({ where: (p, { eq }) => eq(p.slug, 'workflow') }))?.id;
  if (!projId) throw new Error('Failed to find or create project');

  // 4. Create Environments
  const envConfigs = [
    { name: 'Development', slug: 'dev' },
    { name: 'Staging', slug: 'staging' },
    { name: 'Production', slug: 'prod' },
  ];

  const envMap: Record<string, string> = {};
  for (const conf of envConfigs) {
    const [env] = await db
      .insert(environments)
      .values({
        projectId: projId,
        name: conf.name,
        slug: conf.slug,
      })
      .onConflictDoNothing()
      .returning();

    if (env) {
      envMap[conf.slug] = env.id;
    } else {
      const existing = await db.query.environments.findFirst({
        where: (e, { and, eq }) => and(eq(e.projectId, projId), eq(e.slug, conf.slug)),
      });
      if (existing) envMap[conf.slug] = existing.id;
    }
  }

  // 5. Derive encryption key for this project
  const projectKey = deriveProjectKey(masterKey, projId);

  // 6. Insert sample secrets
  const sampleSecrets = [
    {
      name: 'DATABASE_URL',
      comment: 'Postgres connection pooler URL',
      values: {
        dev: 'postgresql://postgres:devpass@localhost:5432/workflow_dev',
        staging: 'postgresql://postgres:stagingpass@db.staging.keyzen.dev:5432/workflow_staging',
        prod: 'postgresql://postgres:prodpass@db.prod.keyzen.dev:5432/workflow_prod',
      },
    },
    {
      name: 'STRIPE_SECRET_KEY',
      comment: 'Stripe API live billing secret key',
      values: {
        dev: 'mock_stripe_key_dev_placeholder',
        staging: 'mock_stripe_key_staging_placeholder',
        prod: 'mock_stripe_key_prod_placeholder',
      },
    },
    {
      name: 'OPENAI_API_KEY',
      comment: 'LLM orchestration agent key',
      values: {
        dev: 'mock_openai_key_dev_placeholder',
        staging: 'mock_openai_key_staging_placeholder',
        prod: 'mock_openai_key_prod_placeholder',
      },
    },
  ];

  for (const s of sampleSecrets) {
    const [sec] = await db
      .insert(secrets)
      .values({
        projectId: projId,
        name: s.name,
        comment: s.comment,
      })
      .onConflictDoNothing()
      .returning();

    const secId = sec?.id || (await db.query.secrets.findFirst({
      where: (secTable, { and, eq }) => and(eq(secTable.projectId, projId), eq(secTable.name, s.name)),
    }))?.id;

    if (!secId) continue;

    for (const [envSlug, plaintext] of Object.entries(s.values)) {
      const envId = envMap[envSlug];
      if (!envId) continue;

      const encrypted = await encryptSecret(plaintext, projectKey, projId);
      await db
        .insert(secretValues)
        .values({
          secretId: secId,
          environmentId: envId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          version: 1,
        })
        .onConflictDoNothing();
    }
  }

  // 7. Create a Dev Service Token
  const { token, hash } = generateServiceToken('dev');
  const [createdToken] = await db
    .insert(serviceTokens)
    .values({
      projectId: projId,
      environmentId: envMap['dev'],
      name: 'Local Dev CLI - Seed',
      tokenHash: hash,
      tokenPrefix: token.substring(0, 16) + '...',
      createdBy: 'developer@keyzen.dev',
    })
    .onConflictDoNothing()
    .returning();

  // 8. Add Audit Log
  await db.insert(auditLogs).values({
    orgId,
    projectId: projId,
    actorType: 'USER',
    actorId: 'dev-user',
    actorName: 'developer@keyzen.dev',
    action: 'SEED_INITIALIZE',
    metadata: { note: 'Initial project seeded successfully' },
    ipAddress: '127.0.0.1',
  });

  console.log('✅ Seed completed successfully!');
  console.log('Organization:', 'Keyzen Dev Team (slug: keyzen-dev)');
  console.log('Project:', 'Workflow App (slug: workflow)');
  console.log('Environments:', Object.keys(envMap).join(', '));
  if (createdToken) {
    console.log('Sample Service Token:', token);
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
