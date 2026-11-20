# aegis-secrets

[![npm version](https://img.shields.io/npm/v/aegis-secrets.svg)](https://www.npmjs.com/package/aegis-secrets)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Zero-disk secrets management for Node.js.**  
> Inject, resolve, and orchestrate runtime secrets directly in memory without shipping `.env` files or committing credentials.

---

## Table of Contents

- [Why aegis-secrets?](#why-aegis-secrets)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [1. Programmatic Injection (Runtime SDK)](#1-programmatic-injection-runtime-sdk)
  - [2. Zero-Code CLI Runner](#2-zero-code-cli-runner)
- [SDK API Reference](#sdk-api-reference)
  - [Configuration Options](#configuration-options)
  - [Methods](#methods)
- [CLI Reference](#cli-reference)
  - [Global Options & Environment Variables](#global-options--environment-variables)
  - [Commands](#commands)
- [Security & Invariants](#security--invariants)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)
- [License](#license)

---

## Why aegis-secrets?

- 🔒 **Zero Plaintext on Disk**: Secrets exist strictly in memory. Eliminates `.env` files, leaked git commits, and accidental disk forensics.
- 🛡️ **Server-Only Protection**: Built-in guard that refuses to execute in browser or bundler client contexts.
- 🎯 **Least-Privilege Scoping**: Service tokens are scoped strictly to one Project and one Environment (`production`, `staging`, `development`).
- ⚡ **Built-in Resilience**: In-memory caching with configurable TTL, request timeouts, and exponential backoff on HTTP 429 and 5xx errors.
- 🧼 **Process Sanitization**: Child processes launched via `run` inherit injected secrets while stripping all `AEGIS_*` token metadata from the child environment.

---

## Installation

### For your Node.js application:
```bash
npm install aegis-secrets
# or
pnpm add aegis-secrets
# or
yarn add aegis-secrets
```

### For CLI usage:
```bash
# Run on-demand via npx
npx aegis-secrets <command>

# Or install globally
npm install -g aegis-secrets
```

> **Note**: Both `aegis-secrets` and `aegis` are registered as executable CLI binary aliases.

---

## Quick Start

### 1. Programmatic Injection (Runtime SDK)

Inject secrets directly into `process.env` at server initialization before loading application dependencies:

```typescript
// server.ts / index.ts (at the very top of your entrypoint)
import { Aegis } from 'aegis-secrets';

const aegis = new Aegis({
  projectId: 'prj_01h7x9m2',
  environment: 'production',
  apiKey: process.env.AEGIS_SERVICE_TOKEN,
  endpoint: 'https://api.your-aegis-domain.com', // Optional: defaults to AEGIS_API_URL or http://localhost:3001
});

// Fetch and inject secrets into process.env
await aegis.inject();

// Now access your secrets safely
console.log('Database connected to:', process.env.DATABASE_URL);
```

#### Selective Injection
You can also inject only a specific subset of secrets:

```typescript
await aegis.inject(['DATABASE_URL', 'STRIPE_SECRET_KEY']);
```

#### Querying Secrets in Memory (Without Mutating `process.env`)
If you prefer not to pollute `process.env`:

```typescript
await aegis.sync();

const dbUrl = aegis.get('DATABASE_URL');
const allSecrets = aegis.getAll(); // Returns a read-only frozen record

console.log(allSecrets.API_KEY);

// Clear in-memory secrets cache when no longer needed
aegis.disconnect();
```

---

### 2. Zero-Code CLI Runner

Run any existing application or script without modifying code. Secrets are injected in-memory into the spawned child process:

```bash
# 1. Store your service token securely in the OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager)
npx aegis-secrets login

# 2. Initialize project configuration in ~/.config/aegis/config.json
npx aegis-secrets init --project prj_01h7x9m2 --environment production --endpoint https://api.your-aegis-domain.com

# 3. Launch your application with in-memory secrets
npx aegis-secrets run -- npm start
# or
npx aegis-secrets run -- node dist/server.js
# or
npx aegis-secrets run -- python3 main.py
```

---

## SDK API Reference

### `new Aegis(options: AegisOptions)`

Creates a new Aegis SDK client instance.

#### Configuration Options

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `projectId` | `string` | **Yes** | — | Unique project identifier. |
| `environment` | `string` | **Yes** | — | Target environment slug (e.g. `production`, `staging`, `development`). |
| `apiKey` | `string` | No | `process.env.AEGIS_SERVICE_TOKEN` | Aegis service token (`ags_...`). |
| `endpoint` | `string` | No | `process.env.AEGIS_API_URL` or `http://localhost:3001` | Aegis API base URL. |
| `cacheTtlMs` | `number` | No | `60000` (60s) | In-memory cache time-to-live in milliseconds. |
| `timeoutMs` | `number` | No | `5000` (5s) | HTTP request timeout per attempt in milliseconds. |
| `retries` | `number` | No | `2` | Number of retries on 429/5xx (0 to 5). |

---

### Methods

#### `aegis.inject(names?: string[]): Promise<void>`
Fetches the latest secrets and assigns them to `process.env`. Optionally accepts an array of secret names to restrict injection.

#### `aegis.sync(names?: string[]): Promise<void>`
Resolves encrypted secrets from the server and populates the local in-memory cache.

#### `aegis.get(key: string): string | undefined`
Retrieves a single secret from the local cache. Returns `undefined` if not found or if the cache expired.

#### `aegis.getAll(): Readonly<Record<string, string>>`
Returns a frozen, read-only dictionary of all currently cached secrets.

#### `aegis.validate(): Promise<boolean>`
Validates that the active service token is legitimate, not expired, and matches the configured project.

#### `aegis.run(args: string[]): Promise<number>`
Spawns a child process, passes in-memory decrypted secrets via the child process environment, strips any `AEGIS_*` tokens, relays `SIGINT`/`SIGTERM` signals, and returns the exit code.

#### `aegis.disconnect(): void`
Purges all decrypted secret values from the internal in-memory cache.

---

## CLI Reference

### Global Options & Environment Variables

Every command supports both CLI flags and environment variables:

| Flag | Environment Variable | Description |
|---|---|---|
| `--project <id>` | `AEGIS_PROJECT_ID` | Project ID |
| `--environment <name>` | `AEGIS_ENVIRONMENT` | Environment name (`production`, `staging`, etc.) |
| `--endpoint <url>` | `AEGIS_API_URL` | Aegis API endpoint URL |
| `--timeout <ms>` | — | Request timeout in milliseconds (default: `5000`) |
| — | `AEGIS_SERVICE_TOKEN` | Service token (overrides OS keychain token) |

---

### Commands

#### `aegis-secrets login`
Securely saves a service token into your operating system's native keychain (macOS Keychain, Linux Secret Service / Keyring, Windows Credential Vault).
```bash
npx aegis-secrets login
```

#### `aegis-secrets init`
Validates the token against the API and writes non-sensitive project configuration (`projectId`, `environment`, `endpoint`) to `~/.config/aegis/config.json`.
```bash
npx aegis-secrets init --project <projectId> --environment production --endpoint https://api.aegis.dev
```

#### `aegis-secrets validate`
Verifies that the current token is valid and authorized for the target project.
```bash
npx aegis-secrets validate
```

#### `aegis-secrets run -- <command...>`
Runs a command with secrets dynamically populated in its process environment.
```bash
npx aegis-secrets run -- node app.js
npx aegis-secrets run -- npx prisma migrate deploy
```

#### `aegis-secrets pull`
Outputs secrets to stdout for inspection or integration with other CLI tools without creating unencrypted files on disk.
```bash
# Print as JSON (default)
npx aegis-secrets pull

# Print in standard KEY=VALUE format
npx aegis-secrets pull --format env

# Filter specific keys
npx aegis-secrets pull --name DATABASE_URL --name REDIS_URL --format env
```

#### `aegis-secrets logout`
Deletes the stored service token from the operating system keychain.
```bash
npx aegis-secrets logout
```

---

## Security & Invariants

1. **Client Isolation**: The SDK decrypts values server-side and transfers them over TLS directly into Node process memory. Ciphertext and master key material never reach the application.
2. **Blocked Names**: For security against process hijacking, the SDK rejects and refuses to override sensitive system variables such as `PATH`, `NODE_OPTIONS`, `LD_PRELOAD`, and `DYLD_INSERT_LIBRARIES`.
3. **Token Scrubbing**: When running sub-processes with `run`, all `AEGIS_*` environment variables (such as `AEGIS_SERVICE_TOKEN`) are automatically stripped so child workers or scripts cannot leak credential tokens to subprocesses.
4. **Server Boundary Enforcement**: The package validates the execution environment and immediately throws an `AegisServerOnlyError` if loaded within a browser DOM (`window !== undefined`).

---

## Error Handling

All SDK errors inherit from `AegisError` and include a machine-readable `.code`:

```typescript
import {
  Aegis,
  AegisAuthenticationError,
  AegisRateLimitError,
  AegisNetworkError,
  AegisConfigError,
} from 'aegis-secrets';

try {
  const aegis = new Aegis({ projectId: 'prj_1', environment: 'production' });
  await aegis.inject();
} catch (error) {
  if (error instanceof AegisAuthenticationError) {
    console.error('Invalid or expired service token:', error.code); // 'AUTHENTICATION'
  } else if (error instanceof AegisRateLimitError) {
    console.error('Too many requests, backoff exceeded:', error.code); // 'RATE_LIMITED'
  } else if (error instanceof AegisNetworkError) {
    console.error('Network failure or API unavailable:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Error Codes

- `SERVER_ONLY`: Attempted to run in a browser or non-Node environment.
- `CONFIG`: Missing required configuration (`projectId`, `environment`, or token).
- `INPUT`: Invalid secret name format (names must match `^[A-Z_][A-Z0-9_]*$`).
- `AUTHENTICATION`: HTTP 401 or 403 (service token invalid, expired, or wrong scope).
- `RATE_LIMITED`: HTTP 429 received and all retry attempts exhausted.
- `NETWORK`: Request timeout, connection error, or 5xx server failure.
- `RESPONSE`: Server returned unexpected or invalid JSON schema.
- `COMMAND`: Failed to start or communicate with a spawned CLI child process.

---

## TypeScript Support

`aegis-secrets` is written in TypeScript and ships with comprehensive type definitions for both ESM and CommonJS:

- ESM: `import { Aegis } from 'aegis-secrets'`
- CJS: `const { Aegis } = require('aegis-secrets')`
- Types: `import type { AegisOptions, AegisSecret, AegisErrorCode } from 'aegis-secrets'`

---

## License

MIT © [Aegis](https://github.com/nithin620)
