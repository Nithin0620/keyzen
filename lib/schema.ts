import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Organizations
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable('org_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role', { enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] }).default('MEMBER').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Environments (dev, staging, prod)
export const environments = pgTable('environments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // "Development", "Production"
  slug: text('slug').notNull(), // "dev", "prod"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Secrets
export const secrets = pgTable(
  'secrets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectSecretUnique: uniqueIndex('project_secret_name_idx').on(t.projectId, t.name),
  })
);

// Secret Values (Encrypted)
export const secretValues = pgTable(
  'secret_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    secretId: uuid('secret_id').references(() => secrets.id, { onDelete: 'cascade' }).notNull(),
    environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    secretEnvUnique: uniqueIndex('secret_env_idx').on(t.secretId, t.environmentId),
  })
);

// Service Tokens for CLI & SDK
export const serviceTokens = pgTable('service_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  tokenPrefix: text('token_prefix').notNull(),
  createdBy: text('created_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  actorType: text('actor_type', { enum: ['USER', 'SERVICE_TOKEN', 'SYSTEM'] }).notNull(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name'),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  environments: many(environments),
  secrets: many(secrets),
  serviceTokens: many(serviceTokens),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
  secretValues: many(secretValues),
  serviceTokens: many(serviceTokens),
}));

export const secretsRelations = relations(secrets, ({ one, many }) => ({
  project: one(projects, {
    fields: [secrets.projectId],
    references: [projects.id],
  }),
  values: many(secretValues),
}));

export const secretValuesRelations = relations(secretValues, ({ one }) => ({
  secret: one(secrets, {
    fields: [secretValues.secretId],
    references: [secrets.id],
  }),
  environment: one(environments, {
    fields: [secretValues.environmentId],
    references: [environments.id],
  }),
}));

export const serviceTokensRelations = relations(serviceTokens, ({ one }) => ({
  project: one(projects, {
    fields: [serviceTokens.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [serviceTokens.environmentId],
    references: [environments.id],
  }),
}));
