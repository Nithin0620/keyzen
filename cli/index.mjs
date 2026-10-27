#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.keyzen');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

async function fetchSecrets(token, endpoint) {
  const url = `${endpoint.replace(/\/+$/, '')}/api/v1/resolve`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Keyzen-CLI/2.0',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to resolve secrets (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.secrets || {};
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
\x1b[32mKeyzen CLI\x1b[0m - Zero-Disk Secret Injection

Usage:
  keyzen login <token>
  keyzen run [--token <token>] [--endpoint <url>] -- <command>
  keyzen get <key>

Examples:
  keyzen login kzn_prod_xyz...
  keyzen run -- npm start
  keyzen run -- node index.js
    `);
    process.exit(0);
  }

  const config = loadConfig();

  if (command === 'login') {
    const token = args[1];
    if (!token) {
      console.error('\x1b[31mError: Please provide a service token.\x1b[0m Example: keyzen login kzn_prod_...');
      process.exit(1);
    }
    saveConfig({ ...config, token });
    console.log('\x1b[32m✔ Authenticated successfully.\x1b[0m Token saved to ~/.keyzen/config.json');
    process.exit(0);
  }

  if (command === 'run') {
    let token = process.env.KEYZEN_TOKEN || config.token;
    let endpoint = process.env.KEYZEN_ENDPOINT || config.endpoint || 'http://localhost:3000';

    // Parse options before '--'
    let cmdIndex = args.indexOf('--');
    let cliArgs = cmdIndex !== -1 ? args.slice(1, cmdIndex) : [];
    let childArgs = cmdIndex !== -1 ? args.slice(cmdIndex + 1) : args.slice(1);

    for (let i = 0; i < cliArgs.length; i++) {
      if (cliArgs[i] === '--token' && cliArgs[i + 1]) {
        token = cliArgs[i + 1];
        i++;
      } else if (cliArgs[i] === '--endpoint' && cliArgs[i + 1]) {
        endpoint = cliArgs[i + 1];
        i++;
      }
    }

    if (!token) {
      console.error('\x1b[31mError: No service token provided.\x1b[0m Run `keyzen login <token>` or pass `--token <token>`.');
      process.exit(1);
    }

    if (childArgs.length === 0) {
      console.error('\x1b[31mError: No command specified to run.\x1b[0m Example: `keyzen run -- npm start`');
      process.exit(1);
    }

    process.stdout.write('\x1b[36m⚡ Fetching secrets from Keyzen...\x1b[0m ');
    try {
      const secrets = await fetchSecrets(token, endpoint);
      const secretCount = Object.keys(secrets).length;
      console.log(`\x1b[32m✔ Injected ${secretCount} secrets into memory (zero-disk)\x1b[0m`);

      const [bin, ...cmdParams] = childArgs;
      const childEnv = { ...process.env, ...secrets };

      const child = spawn(bin, cmdParams, {
        stdio: 'inherit',
        env: childEnv,
      });

      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
      child.on('error', (err) => {
        console.error(`\x1b[31mFailed to start subprocess:\x1b[0m ${err.message}`);
        process.exit(1);
      });
    } catch (err) {
      console.log('');
      console.error(`\x1b[31m✖ Error:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'get') {
    const key = args[1];
    const token = process.env.KEYZEN_TOKEN || config.token;
    const endpoint = process.env.KEYZEN_ENDPOINT || config.endpoint || 'http://localhost:3000';

    if (!key) {
      console.error('\x1b[31mError: Specify a secret key to get.\x1b[0m Example: keyzen get DATABASE_URL');
      process.exit(1);
    }
    if (!token) {
      console.error('\x1b[31mError: No service token provided.\x1b[0m Run `keyzen login <token>`.');
      process.exit(1);
    }

    try {
      const secrets = await fetchSecrets(token, endpoint);
      if (secrets[key] !== undefined) {
        console.log(secrets[key]);
      } else {
        console.error(`\x1b[31mSecret "${key}" not found.\x1b[0m`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    return;
  }

  console.error(`\x1b[31mUnknown command: ${command}\x1b[0m. Run \`keyzen --help\` for usage.`);
  process.exit(1);
}

main();
