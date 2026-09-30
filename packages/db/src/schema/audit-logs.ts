import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { organizations } from './organizations';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  actorType: text('actor_type', { enum: ['USER', 'SERVICE_TOKEN', 'SYSTEM'] }).notNull(),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name'),
  action: text('action').notNull(), // 'SECRET_CREATE', 'SECRET_UPDATE', 'SECRET_REVEAL', 'SECRET_RESOLVE', 'TOKEN_CREATE', 'TOKEN_REVOKE'
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [auditLogs.projectId],
    references: [projects.id],
  }),
}));
