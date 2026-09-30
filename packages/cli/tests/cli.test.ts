import { describe, it, expect } from 'vitest';
import { resolveActiveToken, resolveActiveEndpoint } from '../src/config-store';

describe('Keyzen CLI Configuration and Helpers', () => {
  it('should prioritize explicit CLI option token over environment variable', () => {
    process.env.KEYZEN_TOKEN = 'env_token_123';
    const active = resolveActiveToken('explicit_token_456');
    expect(active).toBe('explicit_token_456');
  });

  it('should fall back to environment variable if no CLI token passed', () => {
    process.env.KEYZEN_TOKEN = 'env_token_123';
    const active = resolveActiveToken(undefined);
    expect(active).toBe('env_token_123');
  });

  it('should resolve default endpoint if none provided', () => {
    delete process.env.KEYZEN_ENDPOINT;
    const endpoint = resolveActiveEndpoint(undefined);
    expect(endpoint).toBe('http://localhost:4000');
  });
});
