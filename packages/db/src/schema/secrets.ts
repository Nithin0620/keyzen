import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { environments } from './environments';

export const secrets = pgTable('secrets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g. "STRIPE_SECRET_KEY"
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  projectSecretUnique: uniqueIndex('project_secret_name_idx').on(t.projectId, t.name),
}));

export const secretValues = pgTable('secret_values', {
  id: uuid('id').defaultRandom().primaryKey(),
  secretId: uuid('secret_id').references(() => secrets.id, { onDelete: 'cascade' }).notNull(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  ciphertext: text('ciphertext').notNull(), // AES-256-GCM ciphertext hex
  iv: text('iv').notNull(),                 // 12-byte IV hex
  authTag: text('auth_tag').notNull(),     // 16-byte GCM auth tag hex
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  secretEnvUnique: uniqueIndex('secret_env_idx').on(t.secretId, t.environmentId),
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
