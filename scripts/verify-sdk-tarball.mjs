import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sdkDir = join(root, 'packages', 'sdk');
const tempDir = mkdtempSync(join(tmpdir(), 'aegis-sdk-pack-'));

try {
  execFileSync('pnpm', ['build'], { cwd: sdkDir, stdio: 'inherit' });
  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', tempDir],
    { cwd: sdkDir, encoding: 'utf8' }
  );
  const [{ filename }] = JSON.parse(packOutput);
  const appDir = join(tempDir, 'sample-app');
  mkdirSync(appDir);

  execFileSync('npm', ['init', '-y'], { cwd: appDir, stdio: 'ignore' });
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', join(tempDir, filename)],
    { cwd: appDir, stdio: 'inherit' }
  );

  execFileSync(
    process.execPath,
    [
      '-e',
      'const sdk = require("aegis"); if (typeof sdk.Aegis !== "function") process.exit(1);',
    ],
    { cwd: appDir, encoding: 'utf8' }
  );
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      'import { Aegis } from "aegis"; if (typeof Aegis !== "function") process.exit(1);',
    ],
    { cwd: appDir, encoding: 'utf8' }
  );

  if (existsSync(join(appDir, '.env'))) {
    throw new Error('packed SDK created a .env file');
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
