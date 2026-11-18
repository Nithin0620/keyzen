import { z } from 'zod';
import { objectIdSchema } from './workspaces';

export const auditQuerySchema = z.object({
  projectId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const auditParamSchema = z.object({
  workspaceId: objectIdSchema,
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditView {
  id: string;
  workspaceId: string;
  projectId: string | null;
  actorType: 'USER' | 'SERVICE_TOKEN' | 'SYSTEM';
  actorId: string;
  action: string;
  metadata: Record<string, unknown>;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}
