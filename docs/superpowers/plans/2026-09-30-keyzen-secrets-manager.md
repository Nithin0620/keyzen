# Keyzen Developer Secrets Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Keyzen — an end-to-end developer secrets management platform featuring a Supabase (PostgreSQL) database, Fastify backend with Apollo Server GraphQL (for management & dashboard) and high-speed REST (for runtime resolution), a cryptographic envelope encryption layer (AES-256-GCM), a developer CLI (`keyzen run`), an SDK (`@keyzen/node`), and a Next.js web dashboard.

**Architecture:** A pnpm monorepo containing shared packages (`packages/crypto`, `packages/db`, `packages/sdk-node`, `packages/cli`) and applications (`apps/api`, `apps/web`). Security is guaranteed via AES-256-GCM envelope encryption so that secret values are never stored or logged in plaintext. Fastify handles REST queries at low latency while Apollo Server exposes deep relational schemas for the Next.js management dashboard.

**Tech Stack:** 
- Monorepo: `pnpm workspaces` + `turborepo` + TypeScript
- Database: **Supabase (PostgreSQL)** + **Drizzle ORM**
- Backend: **Fastify** + **Apollo Server v4** (`@as-integrations/fastify`) + **Drizzle** + **Zod**
- Security / Crypto: Node.js `crypto` with `AES-256-GCM` & HKDF envelope key management
- Developer CLI & SDK: Node.js, `commander`, `execa`, `dotenv`, `@keyzen/node`
- Frontend: **Next.js (App Router)**, **Tailwind CSS**, **shadcn/ui**, **Apollo Client**

## Global Constraints
- All database operations on secrets must store only `ciphertext`, `iv`, `auth_tag`, and `key_version` — never plaintext secrets.
- Secrets resolution runtime REST API must authenticate via scoped `ServiceToken` headers (`Authorization: Bearer kzn_...`).
- Secret metadata queries in GraphQL must NEVER return `encrypted_value` or decrypted plaintext unless explicitly requesting privileged `revealSecret` mutation / query with RBAC verification and audit logging.
- Use exact TypeScript strict typing across all packages.

---

### Task 1: Monorepo Scaffolding and Workspace Configuration

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: Root workspace configuration for `packages/*` and `apps/*`

- [ ] **Step 1: Create root package.json and pnpm-workspace.yaml**
```json
{
  "name": "keyzen",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml, turbo.json, tsconfig.base.json, and .gitignore**
- [ ] **Step 3: Run `pnpm install` to verify monorepo setup**
- [ ] **Step 4: Commit initial workspace scaffolding**
```bash
git init
git add .
git commit -m "chore: scaffold pnpm workspace and turbo config"
```

---

### Task 2: Cryptography Package (`packages/crypto`)

**Files:**
- Create: `packages/crypto/package.json`
- Create: `packages/crypto/tsconfig.json`
- Create: `packages/crypto/src/types.ts`
- Create: `packages/crypto/src/cipher.ts`
- Create: `packages/crypto/src/keys.ts`
- Create: `packages/crypto/src/index.ts`
- Test: `packages/crypto/tests/cipher.test.ts`

**Interfaces:**
- Produces:
  - `encryptSecret(plaintext: string, projectKey: Buffer): Promise<EncryptedPayload>`
  - `decryptSecret(payload: EncryptedPayload, projectKey: Buffer): Promise<string>`
  - `generateProjectKey(): Buffer`
  - `deriveProjectKey(masterKey: string, projectId: string): Buffer`
  - `hashToken(token: string): string`

- [ ] **Step 1: Write the failing tests for AES-256-GCM encryption, decryption, and key derivation**
```typescript
// packages/crypto/tests/cipher.test.ts
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, generateProjectKey, deriveProjectKey } from '../src';

describe('Keyzen Cryptography Engine', () => {
  it('should encrypt and decrypt secret values accurately', async () => {
    const key = generateProjectKey();
    const plaintext = 'placeholder_secret_value';
    const encrypted = await encryptSecret(plaintext, key);
    
    expect(encrypted.ciphertext).not.toEqual(plaintext);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = await decryptSecret(encrypted, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('should fail decryption if auth tag is tampered with', async () => {
    const key = generateProjectKey();
    const encrypted = await encryptSecret('secret_value', key);
    encrypted.authTag = '00000000000000000000000000000000';

    await expect(decryptSecret(encrypted, key)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
Run: `pnpm --filter @keyzen/crypto test`
Expected: FAIL (modules missing)

- [ ] **Step 3: Implement AES-256-GCM cipher and key management in `packages/crypto`**
- [ ] **Step 4: Run tests to verify they pass**
Run: `pnpm --filter @keyzen/crypto test`
Expected: PASS

- [ ] **Step 5: Commit `packages/crypto`**
```bash
git add packages/crypto
git commit -m "feat(crypto): implement AES-256-GCM envelope encryption and key utilities"
```

---

### Task 3: Supabase Database Schema & Drizzle ORM (`packages/db`)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema/organizations.ts`
- Create: `packages/db/src/schema/projects.ts`
- Create: `packages/db/src/schema/environments.ts`
- Create: `packages/db/src/schema/secrets.ts`
- Create: `packages/db/src/schema/service-tokens.ts`
- Create: `packages/db/src/schema/audit-logs.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: PostgreSQL connection string (`DATABASE_URL` from Supabase)
- Produces: Drizzle ORM schema definitions, relations, and database client (`db`)

- [ ] **Step 1: Define Drizzle schema with relational models**
  - `organizations` (`id`, `name`, `slug`, `created_at`)
  - `org_members` (`id`, `org_id`, `user_id`, `role: OWNER|ADMIN|MEMBER|VIEWER`)
  - `projects` (`id`, `org_id`, `name`, `slug`, `created_at`)
  - `environments` (`id`, `project_id`, `name`, `slug: dev|staging|production`)
  - `secrets` (`id`, `project_id`, `name`, `comment`, `created_at`, `updated_at`)
  - `secret_values` (`id`, `secret_id`, `environment_id`, `ciphertext`, `iv`, `auth_tag`, `version`)
  - `service_tokens` (`id`, `project_id`, `environment_id`, `name`, `token_hash`, `expires_at`, `created_at`)
  - `audit_logs` (`id`, `org_id`, `project_id`, `actor_type`, `actor_id`, `action`, `metadata`, `ip_address`, `created_at`)
- [ ] **Step 2: Generate Drizzle migrations and test client export**
- [ ] **Step 3: Commit `packages/db`**
```bash
git add packages/db
git commit -m "feat(db): create Supabase PostgreSQL Drizzle schema and migrations"
```

---

### Task 4: Backend Fastify API with REST Runtime Endpoints (`apps/api`)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/routes/runtime-secrets.ts`
- Create: `apps/api/src/services/secret-resolver.ts`
- Test: `apps/api/tests/runtime-secrets.test.ts`

**Interfaces:**
- Consumes: `@keyzen/db`, `@keyzen/crypto`
- Produces:
  - `POST /api/v1/secrets/resolve`: Resolves key-value decrypted map for CLI & SDK using scoped `ServiceToken`
  - `GET /api/v1/health`: Healthcheck

- [ ] **Step 1: Write failing test for `POST /api/v1/secrets/resolve`**
```typescript
// apps/api/tests/runtime-secrets.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/server';

describe('Runtime Secrets REST API', () => {
  it('should reject requests without valid Bearer token', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/secrets/resolve',
      payload: { project: 'test-project', environment: 'production' }
    });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `pnpm --filter @keyzen/api test`
- [ ] **Step 3: Implement Fastify authentication plugin and `/api/v1/secrets/resolve` endpoint**
  - Verify service token hash against DB.
  - Fetch encrypted secrets for the environment.
  - Decrypt values in-memory via `@keyzen/crypto`.
  - Log audit entry: `SECRET_RESOLVE_BATCH`.
  - Return JSON payload: `{ secrets: { KEY_NAME: "decrypted_value" } }`.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Fastify REST server**
```bash
git add apps/api
git commit -m "feat(api): implement Fastify runtime secret resolution REST endpoint"
```

---

### Task 5: Management GraphQL API with Apollo Server (`apps/api`)

**Files:**
- Create: `apps/api/src/graphql/typeDefs.ts`
- Create: `apps/api/src/graphql/resolvers/index.ts`
- Create: `apps/api/src/graphql/resolvers/organizations.ts`
- Create: `apps/api/src/graphql/resolvers/projects.ts`
- Create: `apps/api/src/graphql/resolvers/secrets.ts`
- Create: `apps/api/src/graphql/resolvers/audit.ts`
- Create: `apps/api/src/graphql/context.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/tests/graphql.test.ts`

**Interfaces:**
- Consumes: `@as-integrations/fastify`, `@apollo/server`, `@keyzen/db`, `@keyzen/crypto`
- Produces: GraphQL endpoint at `/graphql` (and Apollo Sandbox in dev)

- [ ] **Step 1: Write failing test for GraphQL Queries & Mutations**
- [ ] **Step 2: Define GraphQL schema: queries (`organizations`, `projects`, `secretsMetadata`, `auditLogs`) and mutations (`createSecret`, `updateSecret`, `createServiceToken`, `revokeServiceToken`, `revealSecret`)**
- [ ] **Step 3: Implement Apollo Server integration with Fastify lifecycle**
- [ ] **Step 4: Run tests to verify queries, RBAC, and mutations work**
- [ ] **Step 5: Commit GraphQL integration**
```bash
git add apps/api/src/graphql
git commit -m "feat(api): implement Apollo Server GraphQL management schema and resolvers"
```

---

### Task 6: Developer SDK (`packages/sdk-node`)

**Files:**
- Create: `packages/sdk-node/package.json`
- Create: `packages/sdk-node/tsconfig.json`
- Create: `packages/sdk-node/src/client.ts`
- Create: `packages/sdk-node/src/types.ts`
- Create: `packages/sdk-node/src/index.ts`
- Test: `packages/sdk-node/tests/sdk.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export class Keyzen {
    constructor(options: { token: string; endpoint?: string });
    get(secretName: string): Promise<string | undefined>;
    getAll(): Promise<Record<string, string>>;
    injectEnv(): Promise<void>;
  }
  ```

- [ ] **Step 1: Write failing test for SDK**
- [ ] **Step 2: Implement lightweight HTTP client with in-memory caching and TTL**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit `@keyzen/node` SDK**
```bash
git add packages/sdk-node
git commit -m "feat(sdk): create @keyzen/node runtime client with in-memory cache"
```

---

### Task 7: Developer CLI Tool (`packages/cli`)

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/bin.ts`
- Create: `packages/cli/src/commands/login.ts`
- Create: `packages/cli/src/commands/run.ts`
- Create: `packages/cli/src/commands/get.ts`
- Create: `packages/cli/src/commands/set.ts`
- Create: `packages/cli/src/commands/export.ts`
- Create: `packages/cli/src/config-store.ts`
- Test: `packages/cli/tests/cli.test.ts`

**Interfaces:**
- Produces: `keyzen` executable with commands:
  - `keyzen login`
  - `keyzen run --project <p> --env <e> -- <command>` (e.g. `keyzen run -- npm start`)
  - `keyzen get <SECRET_NAME>`
  - `keyzen set <SECRET_NAME> <VALUE>`
  - `keyzen export --format env > .env.local`

- [ ] **Step 1: Write failing tests for CLI argument parsing and child-process environment injection**
- [ ] **Step 2: Implement CLI commands using `commander` and `execa` to inject secrets into child process environment without touching disk**
- [ ] **Step 3: Run tests to verify execution and secret injection**
- [ ] **Step 4: Commit `packages/cli`**
```bash
git add packages/cli
git commit -m "feat(cli): implement keyzen CLI with zero-disk secret injection"
```

---

### Task 8: Web Management Dashboard (`apps/web`)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/orgs/[orgSlug]/projects/[projectSlug]/page.tsx`
- Create: `apps/web/src/components/secrets/secrets-table.tsx`
- Create: `apps/web/src/components/secrets/secret-modal.tsx`
- Create: `apps/web/src/components/tokens/service-tokens.tsx`
- Create: `apps/web/src/components/audit/audit-table.tsx`
- Create: `apps/web/src/lib/apollo-client.ts`

**Interfaces:**
- Consumes: Apollo Server `/graphql`
- Produces: Web interface for project secret management, environment toggling, RBAC team member roles, service token generation, and audit trail inspection.

- [ ] **Step 1: Setup Next.js App Router with Tailwind CSS, shadcn/ui, and Apollo Client**
- [ ] **Step 2: Build Organizations & Projects dashboard view**
- [ ] **Step 3: Build Secrets Grid with Environment Switcher (Development, Staging, Production) and encrypted reveal/edit modal**
- [ ] **Step 4: Build Service Tokens manager and Audit Log viewer**
- [ ] **Step 5: Verify dashboard flows and commit**
```bash
git add apps/web
git commit -m "feat(web): implement Next.js dashboard for secret management, tokens, and audit logs"
```

---

### Task 9: End-to-End Verification & Documentation

**Files:**
- Create: `README.md`
- Create: `docker-compose.yml` (for local Postgres/Redis if testing offline)
- Create: `examples/sample-node-app/index.js`

- [ ] **Step 1: Create sample Node.js app demonstrating `keyzen run` and `@keyzen/node`**
- [ ] **Step 2: Run end-to-end integration test: create project via GraphQL -> add secret -> resolve via CLI/SDK**
- [ ] **Step 3: Document API and setup guides in `README.md`**
- [ ] **Step 4: Commit final deliverables**
```bash
git add README.md examples
git commit -m "docs: add setup guide, architecture documentation, and examples"
```
