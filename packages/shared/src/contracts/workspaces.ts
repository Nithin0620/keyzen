import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

const settingsSchema = z
  .record(z.string().max(100), z.union([z.string().max(500), z.number(), z.boolean()]))
  .optional();

const workspaceFields = {
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/),
  description: z.string().max(500).optional(),
  settings: settingsSchema,
};

export const workspaceCreateSchema = z.object(workspaceFields);

export const workspaceUpdateSchema = z
  .object({
    name: workspaceFields.name.optional(),
    description: workspaceFields.description,
    settings: settingsSchema,
  })
  .refine((value) => Object.keys(value).length > 0, 'No fields to update');

export const deleteWorkspaceSchema = z.object({
  confirmation: z.string().min(1),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: objectIdSchema,
});

export const memberIdParamSchema = z.object({
  workspaceId: objectIdSchema,
  userId: objectIdSchema,
});

export const invitationIdParamSchema = z.object({
  workspaceId: objectIdSchema,
  invitationId: objectIdSchema,
});

export const memberRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);

export const memberRoleUpdateSchema = z.object({
  role: memberRoleSchema,
});

export const ownerTransferSchema = z.object({
  userId: objectIdSchema,
  confirmation: z.string().min(1),
});

export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: memberRoleSchema,
});

export const invitationTokenSchema = z.object({
  token: z.string().min(20),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type MemberRoleUpdateInput = z.infer<typeof memberRoleUpdateSchema>;
export type OwnerTransferInput = z.infer<typeof ownerTransferSchema>;
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;
