import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { environments } from './environments';

export const serviceTokens = pgTable('service_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g. "Github Actions CI", "Local Dev - Nithin"
  tokenHash: text('token_hash').notNull().unique(), // SHA-256 hash of kzn_token
  tokenPrefix: text('token_prefix').notNull(), // e.g. "kzn_prod_a1b2..."
  createdBy: text('created_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

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
