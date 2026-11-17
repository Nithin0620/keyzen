import { z } from 'zod';
import { permissions, projectRoles } from '../permissions';
import { objectIdSchema } from './workspaces';

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/);

const settingsSchema = z
  .record(z.string().max(100), z.union([z.string().max(500), z.number(), z.boolean()]))
  .optional();

const projectFields = {
  name: z.string().trim().min(1).max(120),
  slug,
  description: z.string().max(500).optional(),
  settings: settingsSchema,
};

export const projectCreateSchema = z.object(projectFields);

export const projectUpdateSchema = z
  .object({
    name: projectFields.name.optional(),
    description: projectFields.description,
    settings: settingsSchema,
  })
  .refine((value) => Object.keys(value).length > 0, 'No fields to update');

export const typedConfirmationSchema = z.object({
  confirmation: z.string().min(1),
});

export const projectIdParamSchema = z.object({
  workspaceId: objectIdSchema,
  projectId: objectIdSchema,
});

export const environmentIdParamSchema = z.object({
  workspaceId: objectIdSchema,
  projectId: objectIdSchema,
  environmentId: objectIdSchema,
});

export const diffParamSchema = z.object({
  workspaceId: objectIdSchema,
  projectId: objectIdSchema,
  fromEnvironmentId: objectIdSchema,
  toEnvironmentId: objectIdSchema,
});

export const projectMemberRoleSchema = z.enum(projectRoles);

export const customPermissionsSchema = z.array(z.enum(permissions)).max(20).default([]);

export const projectMemberCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: projectMemberRoleSchema,
  customPermissions: customPermissionsSchema,
});

export const projectMemberRoleUpdateSchema = z.object({
  role: projectMemberRoleSchema,
  customPermissions: customPermissionsSchema.optional(),
});

export const projectMemberParamSchema = z.object({
  workspaceId: objectIdSchema,
  projectId: objectIdSchema,
  userId: objectIdSchema,
});

export const environmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug,
});

export const environmentUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No fields to update');

export const environmentDuplicateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug,
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type TypedConfirmationInput = z.infer<typeof typedConfirmationSchema>;
export type ProjectMemberCreateInput = z.infer<typeof projectMemberCreateSchema>;
export type ProjectMemberRoleUpdateInput = z.infer<typeof projectMemberRoleUpdateSchema>;
export type EnvironmentCreateInput = z.infer<typeof environmentCreateSchema>;
export type EnvironmentUpdateInput = z.infer<typeof environmentUpdateSchema>;
export type EnvironmentDuplicateInput = z.infer<typeof environmentDuplicateSchema>;
