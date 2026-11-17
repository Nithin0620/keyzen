import { z } from 'zod';

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/);

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug,
  description: z.string().max(500).optional(),
});

export const environmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug,
});

export const secretUpsertSchema = z.object({
  name: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_.-]+$/),
  value: z.string().max(64_000),
  description: z.string().max(500).optional(),
});

export const envImportSchema = z.object({
  environmentId: z.string().regex(/^[a-f\d]{24}$/i),
  contents: z.string().max(1_000_000),
});

export const serviceTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  environmentId: z.string().regex(/^[a-f\d]{24}$/i),
  expiresInDays: z.number().int().min(1).max(365),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type EnvironmentInput = z.infer<typeof environmentSchema>;
export type SecretUpsertInput = z.infer<typeof secretUpsertSchema>;
export type EnvImportInput = z.infer<typeof envImportSchema>;
export type ServiceTokenInput = z.infer<typeof serviceTokenSchema>;
