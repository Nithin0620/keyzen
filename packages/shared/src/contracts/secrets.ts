import { z } from 'zod';
import { objectIdSchema } from './workspaces';

const secretName = z.string().trim().min(1).max(200).regex(/^[A-Z_][A-Z0-9_]*$/);
const secretValue = z.string().max(64_000);

export const secretCreateSchema = z.object({
  environmentId: objectIdSchema,
  name: secretName,
  description: z.string().max(500).optional(),
  value: secretValue,
});

export const secretUpdateSchema = z
  .object({
    name: secretName.optional(),
    description: z.string().max(500).optional(),
    value: secretValue.optional(),
    environmentId: objectIdSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No fields to update')
  .refine((value) => !value.value || Boolean(value.environmentId), 'environmentId is required with value');

export const secretValueUpsertSchema = z.object({
  value: secretValue,
});

export const secretListQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  environmentId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const secretParamSchema = z.object({
  workspaceId: objectIdSchema,
  projectId: objectIdSchema,
  secretId: objectIdSchema,
});

export const environmentSecretParamSchema = z.object({
  workspaceId: objectIdSchema,
  projectId: objectIdSchema,
  environmentId: objectIdSchema,
  secretId: objectIdSchema,
});

export const secretGetQuerySchema = z.object({
  environmentId: objectIdSchema.optional(),
});

export const secretRevealQuerySchema = z.object({
  environmentId: objectIdSchema,
});

export const envImportSchema = z.object({
  environmentId: objectIdSchema,
  contents: z.string().min(1).max(256_000),
});

export const envExportQuerySchema = z.object({
  environmentId: objectIdSchema,
});

export const keyRotationSchema = z.object({
  targetKeyId: z.string().trim().min(1).max(120),
});

export const serviceTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  environmentId: objectIdSchema,
  expiresInDays: z.number().int().min(1).max(365),
});

export type SecretCreateInput = z.infer<typeof secretCreateSchema>;
export type SecretUpdateInput = z.infer<typeof secretUpdateSchema>;
export type SecretValueUpsertInput = z.infer<typeof secretValueUpsertSchema>;
export type SecretListQuery = z.infer<typeof secretListQuerySchema>;
export type SecretGetQuery = z.infer<typeof secretGetQuerySchema>;
export type EnvImportInput = z.infer<typeof envImportSchema>;
export type EnvExportQuery = z.infer<typeof envExportQuerySchema>;
export type KeyRotationInput = z.infer<typeof keyRotationSchema>;
export type ServiceTokenInput = z.infer<typeof serviceTokenSchema>;
