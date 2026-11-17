import type { Schema } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { modelDefinitions, type ModelDefinition } from './schemas';

function definition(name: string): ModelDefinition {
  const found = modelDefinitions.find((item) => item.name === name);
  if (!found) {
    throw new Error(`Missing model definition: ${name}`);
  }
  return found;
}

function uniqueKeys(schema: Schema): string[] {
  return schema
    .indexes()
    .filter((entry) => entry[1]?.unique === true)
    .map((entry) => Object.keys(entry[0] as Record<string, unknown>).join('+'));
}

describe('schema definitions', () => {
  const tenantModels = [
    'WorkspaceMember',
    'Project',
    'ProjectMember',
    'Environment',
    'Secret',
    'SecretValue',
    'SecretHistory',
    'ServiceToken',
    'AuditLog',
    'Webhook',
    'Subscription',
  ];

  it('defines all collections', () => {
    expect(modelDefinitions).toHaveLength(18);
  });

  it.each(tenantModels)('%s is tenant scoped', (name) => {
    expect(definition(name).schema.path('workspaceId')).toBeDefined();
  });

  it('enforces workspace and project slug uniqueness', () => {
    expect(uniqueKeys(definition('Project').schema)).toContain('workspaceId+slug');
    expect(uniqueKeys(definition('Environment').schema)).toContain('projectId+slug');
  });

  it('enforces secret name and value uniqueness', () => {
    expect(uniqueKeys(definition('Secret').schema)).toContain('projectId+name');
    expect(uniqueKeys(definition('SecretValue').schema)).toContain('secretId+environmentId');
    expect(uniqueKeys(definition('SecretHistory').schema)).toContain('secretId+environmentId+valueVersion');
  });

  it('enforces identity and token uniqueness', () => {
    expect(uniqueKeys(definition('Workspace').schema)).toContain('slug');
    expect(uniqueKeys(definition('User').schema)).toContain('email');
    expect(uniqueKeys(definition('ServiceToken').schema)).toContain('tokenHash');
  });

  it('does not define a plaintext value field', () => {
    for (const name of ['SecretValue', 'SecretHistory']) {
      expect(definition(name).schema.path('value')).toBeUndefined();
    }
  });
});
