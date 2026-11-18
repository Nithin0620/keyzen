import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';

export interface CliConfig {
  projectId?: string;
  environment?: string;
  endpoint?: string;
}

export interface CliConfigStore {
  path(): string;
  load(): CliConfig;
  save(config: CliConfig): void;
}

export function defaultConfigPath(): string {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'aegis', 'config.json');
  }
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'aegis', 'config.json');
}

export class FileCliConfigStore implements CliConfigStore {
  constructor(private readonly configPath = defaultConfigPath()) {}

  path(): string {
    return this.configPath;
  }

  load(): CliConfig {
    if (!existsSync(this.configPath)) {
      return {};
    }

    let payload: unknown;
    try {
      payload = JSON.parse(readFileSync(this.configPath, 'utf8'));
    } catch {
      throw new Error('Aegis CLI config is invalid');
    }

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new Error('Aegis CLI config is invalid');
    }

    const record = payload as Record<string, unknown>;
    const allowed = ['projectId', 'environment', 'endpoint'] as const;
    const config: CliConfig = {};

    for (const key of allowed) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) {
        config[key] = value;
      }
    }

    return config;
  }

  save(config: CliConfig): void {
    mkdirSync(dirname(this.configPath), { recursive: true, mode: 0o700 });
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    chmodSync(this.configPath, 0o600);
  }
}
