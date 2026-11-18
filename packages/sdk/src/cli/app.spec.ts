import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AegisOptions } from '../index';
import type { AegisLike, CliOverrides } from './app';
import { runCli } from './app';
import type { CliConfig, CliConfigStore } from './config';
import type { CredentialStore } from './credentials';

const originalToken = process.env.AEGIS_SERVICE_TOKEN;
const originalProject = process.env.AEGIS_PROJECT_ID;
const originalEnvironment = process.env.AEGIS_ENVIRONMENT;
const originalEndpoint = process.env.AEGIS_API_URL;

class MemoryCredentialStore implements CredentialStore {
  readonly kind = 'keychain' as const;
  token: string | null = null;
  deleteCalls = 0;

  async get(): Promise<string | null> {
    return this.token;
  }

  async set(token: string): Promise<void> {
    this.token = token;
  }

  async delete(): Promise<void> {
    this.token = null;
    this.deleteCalls += 1;
  }
}

class FakeClient implements AegisLike {
  validateCalls = 0;
  syncCalls = 0;
  syncNames: string[] | undefined;
  runCalls: string[][] = [];
  runCode = 0;
  disconnectCalls = 0;
  secrets: Record<string, string> = { APP_SECRET: 'test-value' };

  async sync(names?: string[]): Promise<void> {
    this.syncCalls += 1;
    this.syncNames = names;
  }

  getAll(): Readonly<Record<string, string>> {
    return this.secrets;
  }

  async validate(): Promise<boolean> {
    this.validateCalls += 1;
    return true;
  }

  async run(args: string[]): Promise<number> {
    this.runCalls.push(args);
    return this.runCode;
  }

  disconnect(): void {
    this.disconnectCalls += 1;
  }
}

interface Harness {
  overrides: CliOverrides;
  client: FakeClient;
  credentials: MemoryCredentialStore;
  stdout: string[];
  stderr: string[];
  config: CliConfig;
  clientOptions: AegisOptions[];
}

function harness(): Harness {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const client = new FakeClient();
  const credentials = new MemoryCredentialStore();
  const clientOptions: AegisOptions[] = [];
  let config: CliConfig = { projectId: 'project', environment: 'environment' };

  const configStore: CliConfigStore = {
    path: () => '/tmp/aegis-cli-config.json',
    load: () => config,
    save: (next) => {
      config = next;
    },
  };

  return {
    client,
    credentials,
    stdout,
    stderr,
    clientOptions,
    overrides: {
      configStore,
      credentialStore: credentials,
      clientFactory: (options) => {
        clientOptions.push(options);
        return client;
      },
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
      promptToken: async () => 'prompted-token',
    },
    get config() {
      return config;
    },
  };
}

describe('Aegis CLI', () => {
  beforeEach(() => {
    process.env.AEGIS_SERVICE_TOKEN = 'ags_test_token';
    delete process.env.AEGIS_PROJECT_ID;
    delete process.env.AEGIS_ENVIRONMENT;
    delete process.env.AEGIS_API_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalToken === undefined) delete process.env.AEGIS_SERVICE_TOKEN;
    else process.env.AEGIS_SERVICE_TOKEN = originalToken;
    if (originalProject === undefined) delete process.env.AEGIS_PROJECT_ID;
    else process.env.AEGIS_PROJECT_ID = originalProject;
    if (originalEnvironment === undefined) delete process.env.AEGIS_ENVIRONMENT;
    else process.env.AEGIS_ENVIRONMENT = originalEnvironment;
    if (originalEndpoint === undefined) delete process.env.AEGIS_API_URL;
    else process.env.AEGIS_API_URL = originalEndpoint;
  });

  it('validates credentials and saves only non-secret config on init', async () => {
    const h = harness();
    const code = await runCli(
      ['init', '--project', 'project', '--environment', 'environment', '--endpoint', 'https://aegis.test'],
      h.overrides
    );

    expect(code).toBe(0);
    expect(h.client.validateCalls).toBe(1);
    expect(h.config).toEqual({ projectId: 'project', environment: 'environment', endpoint: 'https://aegis.test' });
    expect(h.stdout.join('')).not.toContain('ags_test_token');
  });

  it('pulls requested secrets as structured JSON', async () => {
    const h = harness();
    const code = await runCli(['pull', '--name', 'APP_SECRET'], h.overrides);

    expect(code).toBe(0);
    expect(h.client.syncNames).toEqual(['APP_SECRET']);
    expect(JSON.parse(h.stdout.join(''))).toEqual({ entries: [{ name: 'APP_SECRET', value: 'test-value' }] });
  });

  it('runs a child command in memory and propagates the exit code', async () => {
    const h = harness();
    h.client.runCode = 7;

    const code = await runCli(['run', '--', 'node', 'app.js'], h.overrides);

    expect(code).toBe(7);
    expect(h.client.runCalls).toEqual([['node', 'app.js']]);
    expect(h.stdout.join('')).toBe('');
  });

  it('validates with structured output', async () => {
    const h = harness();
    const code = await runCli(['validate'], h.overrides);

    expect(code).toBe(0);
    expect(JSON.parse(h.stdout.join(''))).toEqual({ valid: true, projectId: 'project', environment: 'environment' });
  });

  it('stores the environment token without printing it', async () => {
    const h = harness();
    const code = await runCli(['login'], h.overrides);

    expect(code).toBe(0);
    expect(h.credentials.token).toBe('ags_test_token');
    expect(h.stdout.join('')).not.toContain('ags_test_token');
  });

  it('uses a keychain token when no environment token exists', async () => {
    const h = harness();
    delete process.env.AEGIS_SERVICE_TOKEN;
    h.credentials.token = 'ags_keychain_token';

    const code = await runCli(['validate'], h.overrides);

    expect(code).toBe(0);
    expect(h.clientOptions[0].apiKey).toBe('ags_keychain_token');
    expect(h.stdout.join('')).not.toContain('ags_keychain_token');
  });

  it('deletes the stored token on logout', async () => {
    const h = harness();
    h.credentials.token = 'ags_test_token';

    const code = await runCli(['logout'], h.overrides);

    expect(code).toBe(0);
    expect(h.credentials.deleteCalls).toBe(1);
    expect(h.credentials.token).toBeNull();
  });

  it('emits structured errors when no token is available', async () => {
    const h = harness();
    delete process.env.AEGIS_SERVICE_TOKEN;

    const code = await runCli(['validate'], h.overrides);

    expect(code).toBe(1);
    expect(JSON.parse(h.stderr.join('')).error.message).toContain('No service token');
  });
});
