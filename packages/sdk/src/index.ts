import {
  AegisCommandError,
  AegisConfigError,
  AegisInputError,
  AegisResponseError,
  AegisServerOnlyError,
} from './errors';
import { requestJson } from './http-client';

export {
  AegisCommandError,
  AegisConfigError,
  AegisError,
  AegisInputError,
  AegisAuthenticationError,
  AegisNetworkError,
  AegisRateLimitError,
  AegisResponseError,
  AegisServerOnlyError,
} from './errors';
export type { AegisErrorCode } from './errors';

export interface AegisOptions {
  projectId: string;
  environment: string;
  apiKey?: string;
  endpoint?: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  retries?: number;
}

export interface AegisSecret {
  name: string;
  value: string;
}

interface RuntimeValidation {
  valid: true;
  workspaceId: string;
  projectId: string;
  environmentId: string;
  expiresAt: string;
}

const SECRET_NAME = /^[A-Z_][A-Z0-9_]*$/;
const BLOCKED_SECRET_NAMES = new Set(['NODE_OPTIONS', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'PATH']);

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new AegisServerOnlyError();
  }
}

assertServerOnly();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlockedSecretName(name: string): boolean {
  return name.startsWith('AEGIS_') || BLOCKED_SECRET_NAMES.has(name);
}

function normalizeEndpoint(endpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new AegisConfigError('Aegis endpoint must be a valid URL');
  }
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username ||
    parsed.password
  ) {
    throw new AegisConfigError('Aegis endpoint must be an http or https URL without credentials');
  }
  return endpoint.replace(/\/+$/, '');
}

function normalizeNames(names: string[] | undefined): string[] | undefined {
  if (!names) {
    return undefined;
  }
  if (names.length === 0) {
    return undefined;
  }
  if (names.length > 200 || names.some((name) => !SECRET_NAME.test(name))) {
    throw new AegisInputError('Aegis secret names must be uppercase environment variable names');
  }
  return names;
}

function parseSecrets(payload: unknown): AegisSecret[] {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    throw new AegisResponseError();
  }

  return payload.entries.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.name !== 'string' ||
      typeof entry.value !== 'string' ||
      !SECRET_NAME.test(entry.name) ||
      isBlockedSecretName(entry.name)
    ) {
      throw new AegisResponseError();
    }
    return { name: entry.name, value: entry.value };
  });
}

function parseValidation(payload: unknown): RuntimeValidation {
  if (
    !isRecord(payload) ||
    payload.valid !== true ||
    typeof payload.workspaceId !== 'string' ||
    typeof payload.projectId !== 'string' ||
    typeof payload.environmentId !== 'string' ||
    typeof payload.expiresAt !== 'string'
  ) {
    throw new AegisResponseError();
  }
  return payload as unknown as RuntimeValidation;
}

export class Aegis {
  private readonly projectId: string;
  private readonly environment: string;
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly cacheTtlMs: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly cache = new Map<string, string>();
  private cacheExpiresAt = 0;

  constructor(options: AegisOptions) {
    assertServerOnly();
    if (!options.projectId || !options.environment) {
      throw new AegisConfigError('Aegis requires projectId and environment');
    }
    if (!Number.isInteger(options.cacheTtlMs ?? 60_000) || (options.cacheTtlMs ?? 60_000) < 0) {
      throw new AegisConfigError('Aegis cacheTtlMs must be a non-negative integer');
    }
    if (!Number.isInteger(options.timeoutMs ?? 5_000) || (options.timeoutMs ?? 5_000) < 1) {
      throw new AegisConfigError('Aegis timeoutMs must be a positive integer');
    }
    if (!Number.isInteger(options.retries ?? 2) || (options.retries ?? 2) < 0 || (options.retries ?? 2) > 5) {
      throw new AegisConfigError('Aegis retries must be an integer between 0 and 5');
    }

    this.projectId = options.projectId;
    this.environment = options.environment;
    this.apiKey = options.apiKey;
    this.endpoint = normalizeEndpoint(options.endpoint ?? process.env.AEGIS_API_URL ?? 'http://localhost:3001');
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.retries = options.retries ?? 2;
  }

  async init(): Promise<void> {
    assertServerOnly();
    await this.validate();
    await this.sync();
  }

  get(key: string): string | undefined {
    assertServerOnly();
    const cache = this.readCache();
    return cache.get(key);
  }

  getAll(): Readonly<Record<string, string>> {
    assertServerOnly();
    const cache = this.readCache();
    return Object.freeze(Object.fromEntries(cache));
  }

  async inject(names?: string[]): Promise<void> {
    assertServerOnly();
    await this.sync(names);
    for (const [name, value] of this.readCache()) {
      process.env[name] = value;
    }
  }

  async sync(names?: string[]): Promise<void> {
    assertServerOnly();
    const payload = await this.request<unknown>('POST', '/v1/secrets/resolve', {
      names: normalizeNames(names),
    });
    const secrets = parseSecrets(payload);
    this.clearCache();
    for (const secret of secrets) {
      this.cache.set(secret.name, secret.value);
    }
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
  }

  async run(args: string[]): Promise<number> {
    assertServerOnly();
    if (args.length === 0) {
      throw new AegisCommandError('Aegis.run requires a command');
    }
    await this.sync();

    const { spawn } = await import('node:child_process');
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const name of Object.keys(childEnv)) {
      if (name.startsWith('AEGIS_')) {
        delete childEnv[name];
      }
    }
    for (const [name, value] of this.readCache()) {
      childEnv[name] = value;
    }

    const child = spawn(args[0], args.slice(1), {
      env: childEnv,
      stdio: 'inherit',
      windowsHide: true,
    });

    return await new Promise<number>((resolve, reject) => {
      const signals = ['SIGINT', 'SIGTERM'] as const;
      const handlers: Partial<Record<NodeJS.Signals, () => void>> = {};

      const cleanup = (): void => {
        for (const signal of signals) {
          const handler = handlers[signal];
          if (handler) {
            process.removeListener(signal, handler);
          }
        }
      };

      const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        cleanup();
        resolve(code ?? (signal ? 128 : 1));
      };

      const onError = (): void => {
        cleanup();
        reject(new AegisCommandError('Aegis could not start the child process'));
      };

      for (const signal of signals) {
        handlers[signal] = () => child.kill(signal);
        process.on(signal, handlers[signal] as () => void);
      }

      child.once('exit', onExit);
      child.once('error', onError);
    });
  }

  async validate(): Promise<boolean> {
    assertServerOnly();
    const payload = await this.request<unknown>('GET', '/v1/validate');
    const validation = parseValidation(payload);
    if (validation.projectId !== this.projectId) {
      throw new AegisResponseError();
    }
    return true;
  }

  disconnect(): void {
    assertServerOnly();
    this.clearCache();
  }

  private requireToken(): string {
    const token = this.apiKey ?? process.env.AEGIS_SERVICE_TOKEN;
    if (!token) {
      throw new AegisConfigError('Aegis requires AEGIS_SERVICE_TOKEN');
    }
    return token;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    return requestJson<T>({
      endpoint: this.endpoint,
      path,
      method,
      token: this.requireToken(),
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      ...(body ? { body } : {}),
    });
  }

  private readCache(): Map<string, string> {
    if (Date.now() >= this.cacheExpiresAt) {
      this.clearCache();
    }
    return this.cache;
  }

  private clearCache(): void {
    this.cache.clear();
    this.cacheExpiresAt = 0;
  }
}
