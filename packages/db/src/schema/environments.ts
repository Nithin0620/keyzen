import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { secretValues } from './secrets';
import { serviceTokens } from './service-tokens';

export const environments = pgTable('environments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g. "Development", "Staging", "Production"
  slug: text('slug').notNull(), // e.g. "dev", "staging", "prod"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
  secretValues: many(secretValues),
  serviceTokens: many(serviceTokens),
}));
