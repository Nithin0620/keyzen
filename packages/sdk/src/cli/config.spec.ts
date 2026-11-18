import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileCliConfigStore } from './config';

const directories: string[] = [];

function tempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aegis-cli-config-'));
  directories.push(dir);
  return join(dir, 'config.json');
}

describe('FileCliConfigStore', () => {
  afterEach(() => {
    for (const dir of directories.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes non-secret config with restrictive permissions', () => {
    const path = tempConfigPath();
    const store = new FileCliConfigStore(path);

    store.save({ projectId: 'project', environment: 'environment', endpoint: 'https://aegis.test' });

    expect((statSync(path).mode & 0o777).toString(8)).toBe('600');
    expect(store.load()).toEqual({
      projectId: 'project',
      environment: 'environment',
      endpoint: 'https://aegis.test',
    });
  });

  it('ignores secret fields in config files', () => {
    const path = tempConfigPath();
    writeFileSync(path, JSON.stringify({ projectId: 'project', apiKey: 'must-not-load' }));

    expect(new FileCliConfigStore(path).load()).toEqual({ projectId: 'project' });
  });
});
