# Aegis

[![npm version](https://img.shields.io/npm/v/aegis-secrets.svg)](https://www.npmjs.com/package/aegis-secrets)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Aegis is a source-available secrets manager with a server-side Node SDK. It keeps secrets encrypted
in MongoDB, exposes them through a permissioned Express API, and injects them into applications at
runtime without writing plaintext `.env` files to disk.

The ownership hierarchy is strict:

```text
User -> Workspace -> Project -> Environment -> Secret
```

Every tenant-owned collection carries a `workspaceId`. Every query is scoped by that verified
identifier, and every non-public route is denied unless a policy explicitly allows it.

> **Published SDK:** the npm package is [`aegis-secrets`](https://www.npmjs.com/package/aegis-secrets).
> npm currently lists `1.2.0`; the workspace source declares `1.3.0` for the next publish. The package
> installs both `aegis` and `aegis-secrets` CLI binaries. Older docs that say `npm i aegis` are stale.

This is a clean rebuild. The earlier prototype is archived outside this repository; its code, schema
and history are intentionally not carried over. See [docs/PLAN.md](docs/PLAN.md) for the original
phase plan and [docs/design.md](docs/design.md) for the design rationale.

---

## Table of contents

- [What Aegis solves](#what-aegis-solves)
- [Architecture at a glance](#architecture-at-a-glance)
- [Repository map](#repository-map)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Backend deep dive](#backend-deep-dive)
- [API surface](#api-surface)
- [Data model and encryption](#data-model-and-encryption)
- [Dashboard deep dive](#dashboard-deep-dive)
- [SDK and CLI deep dive](#sdk-and-cli-deep-dive)
- [Shared contracts](#shared-contracts)
- [Security invariants](#security-invariants)
- [Testing and quality gates](#testing-and-quality-gates)
- [Operations and runbooks](#operations-and-runbooks)
- [Current status and known gaps](#current-status-and-known-gaps)
- [Further reading](#further-reading)

---

## What Aegis solves

Most secret-management setups fail in one of four ways: plaintext files end up on developer disks,
long-lived credentials are shared across environments, reads are not attributable, or the client
receives key material it should never see. Aegis is built around a different set of defaults:

- **No disk plaintext in the runtime path.** The API decrypts server-side and returns values to the
  SDK only over the resolve endpoint. The SDK holds them in memory and can inject them into
  `process.env` or a child process.
- **One tenant boundary.** A workspace ID derived from a verified session or service token scopes
  every read and write. IDs from request bodies are never trusted for authorization.
- **Deny by default.** Public routes are listed in one allowlist. Everything else requires a
  permission evaluated against workspace and project membership.
- **Auditable.** Secret reads and writes, token operations, membership changes and billing events
  produce audit records whose writes are awaited before responses complete.
- **Scoped runtime credentials.** Service tokens are bound to one project and one environment,
  stored as hashes, expire, and can be rotated or revoked immediately.
- **Typed contracts.** Zod schemas in `packages/shared` are reused by the API, dashboard and SDK
  where possible, so validation and view shapes do not drift silently.

Aegis is not a replacement for a cloud KMS. In production the master key comes from a KMS provider
(AWS KMS is implemented); the development `AEGIS_MASTER_KEY` provider exists only for local use.

---

## Architecture at a glance

```text
                         +---------------------------+
   Browser (Next.js)     |  apps/web  :3000          |
   - session cookies     |  App Router + RQ + Radix  |
   - no token storage    |  apiClient credentials    |
                         +-------------+-------------+
                                       | HTTPS / JSON
                                       v
                         +---------------------------+
                         |  apps/api  :3001          |
                         |  Express 4 modular monolith|
   SDK / CLI ----------->|  auth -> params -> policy |
   Bearer ags_ token     |  -> audit -> handler      |
                         +------+-----------+--------+
                                |           |
                 +--------------v--+   +----v-------------+
                 | MongoDB Atlas 8 |   | Redis / memory   |
                 | replica set rs0 |   | revocation + rl  |
                 +-----------------+   +------------------+
                          |
                          v
                 KMS provider (prod) or env key (dev)
```

A typical dashboard request follows this chain:

```text
Next.js page
  -> apiClient.get(path, { searchParams })        // cookies: include
  -> Express app hardening + global validation
  -> router: public allowlist check
  -> JWT guard (or service-token guard for /v1)
  -> Zod param/query validation
  -> policy.evaluate(permission, workspaceId, projectId)
  -> audit context + awaited audit write
  -> controller -> service -> tenant-scoped repository -> MongoDB
  -> sanitized JSON response
```

The SDK takes a shorter path for runtime resolution:

```text
Aegis.inject() / run()
  -> POST /v1/secrets/resolve with Bearer <ags_ token>
  -> per-token rate limit + service-token guard
  -> policy check for the token's project/environment
  -> backend decrypts with AAD binding
  -> { entries: [{ name, value }, ...] }
  -> SDK keeps values in memory, optionally assigns to process.env
```

---

## Repository map

| Path                         | Role                  | Notes                                                        |
| ---------------------------- | --------------------- | ------------------------------------------------------------ |
| `apps/api`                   | Express 4 API         | Auth, RBAC, secrets, runtime, audit, billing, webhooks, jobs |
| `apps/web`                   | Next.js 15 App Router | Dashboard, auth pages, docs pages, static landing page       |
| `packages/shared`            | `@aegis/shared`       | Zod contracts, permissions, role matrices, shared view types |
| `packages/sdk`               | `aegis-secrets`       | Published Node SDK and `aegis` / `aegis-secrets` CLI         |
| `docs/PLAN.md`               | Build plan            | Phase order and security invariants                          |
| `docs/design.md`             | Design notes          | Product and technical decisions                              |
| `docs/PHASE-LOG.md`          | Delivery history      | What was verified in each phase                              |
| `docs/PHASE-13-DASHBOARD.md` | UI tracker            | Sub-stage checklist for the dashboard                        |
| `docs/runbooks/`             | Operations            | Deploy, key rotation, incident response, load test           |
| `scripts/`                   | Local tooling         | Replica-set init, SDK tarball check, load test               |

The root is a pnpm workspace (`pnpm@11.27.0`) requiring Node 20 or newer. Workspace packages are
defined in `pnpm-workspace.yaml`; `packages/shared` is built before typecheck and test because both
apps consume its generated output.

---

## Quick start

```bash
# 1. Install dependencies first so workspace binaries exist.
pnpm install

# 2. Create the local environment file and replace the placeholders.
cp .env.example .env

# 3. Start MongoDB 8 (single-node replica set rs0) and Redis 7.
docker compose up -d

# 4. Initialize the replica set, then create indexes.
pnpm db:init
pnpm build
pnpm db:indexes

# 5. Run the API (:3001) and dashboard (:3000).
pnpm dev
```

Useful URLs after startup:

| URL                                  | Purpose                                      |
| ------------------------------------ | -------------------------------------------- |
| `http://localhost:3000`              | Static marketing/landing page                |
| `http://localhost:3000/auth/login`   | Dashboard login                              |
| `http://localhost:3000/dashboard`    | Authenticated dashboard entry                |
| `http://localhost:3001/health/live`  | Process liveness probe                       |
| `http://localhost:3001/health/ready` | MongoDB/Redis readiness probe                |
| `http://localhost:3001/docs`         | Swagger UI generated from the route manifest |
| `http://localhost:3001/openapi.json` | OpenAPI document                             |

Development seed data is available via `pnpm db:seed`, but it is explicitly fake and dev-only.
Never use it against a shared or production database.

---

## Configuration

All configuration comes from environment variables validated by Zod in
`apps/api/src/config/env.ts`. Copy `.env.example`; never commit `.env`.

| Group         | Variables                                                                                  | Purpose                                                      |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Database      | `MONGODB_URI`                                                                              | MongoDB connection string; local value uses `replicaSet=rs0` |
| Cache         | `REDIS_URL`                                                                                | Redis for revocation/rate-limit state in production          |
| API           | `API_PORT`, `WEB_ORIGIN`, `WEB_ORIGINS`                                                    | Port and CORS allowlist                                      |
| Auth          | `AUTH_SECRET`, `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL`                                       | JWT signing and cookie lifetimes                             |
| Audit         | `AUDIT_RETENTION_DAYS`                                                                     | TTL for audit records                                        |
| Google OAuth  | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`                          | OAuth login and account linking                              |
| Encryption    | `AEGIS_MASTER_KEY`, `AEGIS_KMS_KEY_ID`, `AWS_REGION`                                       | Dev key or production KMS key id                             |
| Email         | `RESEND_API_KEY`, `EMAIL_FROM`                                                             | Verification, reset and invitation mail                      |
| Billing       | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`                             | Checkout and signature-verified webhooks                     |
| Webhooks      | `WEBHOOK_SECRET_ENCRYPTION_KEY`, `WEBHOOK_MAX_ATTEMPTS`, `WEBHOOK_TIMEOUT_MS`              | Outbound HMAC signing and retries                            |
| Jobs          | `JOB_*_INTERVAL_MS`, `JOB_KEY_ROTATION_TARGET_ID`                                          | Cleanup, rotation, retention and retry schedules             |
| Hardening     | `TRUST_PROXY`, `ENFORCE_TLS`, `REQUEST_BODY_LIMIT`, `MAX_URL_LENGTH`, `GLOBAL_RATE_LIMIT*` | Transport and abuse controls                                 |
| Observability | `LOG_LEVEL`, `OTEL_*`, `SENTRY_*`, `ABUSE_ALERT_*`                                         | Logging, tracing and error reporting                         |
| Web           | `NEXT_PUBLIC_API_URL`                                                                      | Browser-side API base URL; required in production builds     |

Production startup fails fast when required values are missing. There are no hardcoded production
keys, tokens or actor identities. Generate local values with a secure random source; the strings in
`.env.example` are placeholders, not usable credentials.

The API serves JWT access and refresh tokens in `httpOnly`, `SameSite=lax` cookies (`Secure` in
production). The dashboard stores only an `aegis_authenticated` UI flag in `localStorage`; it never
reads or writes the tokens itself.

---

## Backend deep dive

### Bootstrap and composition

`apps/api/src/main.ts` starts tracing/error monitoring, builds the dependency container, listens on
`API_PORT`, starts background jobs, and shuts down gracefully on `SIGTERM`/`SIGINT`. The container in
`apps/api/src/container.ts` wires repositories, services and controllers, selects the Redis or
in-memory revocation cache, and registers the key providers.

`apps/api/src/app.ts` installs the HTTP hardening layer before any route is mounted:

- Helmet with HSTS and CSP-related headers.
- CORS limited to `WEB_ORIGIN` / `WEB_ORIGINS`.
- Optional TLS enforcement and proxy trust configuration.
- Request size and URL length limits.
- A global in-process rate limiter that exempts health, docs and OpenAPI.
- Pino request logging with redaction.
- A sanitized error handler that attaches `X-Request-Id` and `Retry-After` where relevant.

Mongoose models are strict. A global input guard rejects `$`-prefixed keys, dotted keys,
prototype-pollution names, excessive depth and unsupported value types before Zod validation.

### Route manifest and guards

Routes are declared through `auditedRoute()` in `apps/api/src/authz/route-manifest.ts`. A definition
carries a stable name, method, path, permission (or `AUTHENTICATED`), auth type, middleware and audit
kind. `apps/api/src/http/router.ts` then applies a fixed middleware order:

1. Reject routes that are neither guarded nor explicitly public.
2. Authenticate with JWT or a service token.
3. Run param/query/body Zod validation.
4. Evaluate the permission against the verified workspace/project context.
5. Establish audit context and await the audit write.
6. Run the controller through `trace()` and `asyncHandler()`.

New routes cannot accidentally become public: `apps/api/src/authz/route-audit.spec.ts` walks the
manifest and fails if permission or audit metadata is missing.

### Authorization model

`packages/shared/src/permissions.ts` defines the permission vocabulary and two independent role
matrices:

- Workspace roles: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.
- Project roles: `OWNER`, `ADMIN`, `DEVELOPER`, `VIEWER`.
- Permissions: `secrets.read/create/update/delete/export`, `environments.manage`, `members.invite`,
  `credentials.manage`, `webhooks.manage`, `audit.read`, `billing.manage`.

For project-scoped requests the policy in `apps/api/src/authz/policy.service.ts` requires an active
user, workspace membership, explicit project membership, and a matching workspace ID on the project.
Custom project-member overrides use `+permission` / `-permission` entries. Workspace membership alone
never grants project access.

### Secret operations

The secrets service implements create, list, get, reveal, update, per-environment value upsert,
`.env` import/export, history, rollback, and key rotation. Important behaviors:

- Values are masked in list responses; `/reveal` performs a separate audited read.
- Import is size- and count-limited and parsed by a strict `.env` parser.
- Export is gated by `secrets.export` and returns `{ entries: [{ name, value }] }`; the browser builds
  the download. The server never writes a file.
- History is appended in the same Mongo transaction as the value change; rollback creates a new
  version instead of deleting history.
- Reads and writes require active project membership and a valid, non-archived environment.

### Runtime API and service tokens

Service tokens are created under
`/workspaces/:workspaceId/projects/:projectId/credentials`, use the `ags_` prefix, and are shown in
plaintext exactly once. Only their hashes are stored. Revocation is cached for immediate effect.

The runtime surface is intentionally small:

- `POST /v1/secrets/resolve` — returns the environment's decrypted entries for the token.
- `GET /v1/validate` — validates token, project and environment without returning values.

Both are service-token-authenticated, rate limited per token, and audited with a service-token actor.

### Integrations and background work

Stripe Checkout creates sessions, but subscription state changes only in the signature-verified
webhook handler. Outbound webhooks are HMAC-signed, allowlisted by event, and blocked from private
and metadata IP ranges. Background jobs handle token expiry, key rotation, audit retention, stale
invitation cleanup and webhook retries; job failures trigger operator alerts.

---

## API surface

The API registers roughly 80 routes, of which a small set (health, docs, auth, OAuth callback and
Stripe webhook) is public. The table below shows representative groups; the authoritative list is
`GET /openapi.json` and the controller files under `apps/api/src`.

| Group           | Base path                              | Representative routes                                                                                                     | Permission / auth                      |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Auth            | `/auth`                                | `POST signup`, `verify`, `login`, `refresh`, `logout`; `GET me`; `POST password-reset/*`; `GET google`, `google/callback` | Mostly public; `/me` authenticated     |
| Workspaces      | `/workspaces`                          | create, list, read, `select`, members, invitations                                                                        | `AUTHENTICATED` or `members.invite`    |
| Projects        | `/workspaces/:workspaceId/projects`    | create, list, get, update, archive, restore, delete                                                                       | `AUTHENTICATED`, `environments.manage` |
| Project members | `.../projects/:projectId/members`      | list, add, change role, remove                                                                                            | `AUTHENTICATED` / `members.invite`     |
| Environments    | `.../projects/:projectId/environments` | CRUD, archive, restore, `duplicate`, `diff`, `resolve`                                                                    | `environments.manage` / `secrets.read` |
| Secrets         | `.../projects/:projectId/secrets`      | CRUD, `import`, `export`, `reveal`, `history`, `rollback`, `keys/rotate`                                                  | `secrets.*`                            |
| Credentials     | `.../projects/:projectId/credentials`  | create, list, `rotate`, `revoke`                                                                                          | `credentials.manage`                   |
| Runtime         | `/v1`                                  | `POST secrets/resolve`, `GET validate`                                                                                    | Service token                          |
| Audit           | `/workspaces/:workspaceId/audit`       | `GET` filtered events                                                                                                     | `audit.read`                           |
| Webhooks        | `.../projects/:projectId/webhooks`     | create, list, `rotate-secret`, `deactivate`, deliveries                                                                   | `webhooks.manage`                      |
| Billing         | `/workspaces/:workspaceId/billing`     | `GET`, `POST checkout`, `POST /billing/webhook`                                                                           | `billing.manage` / public webhook      |
| Health/docs     | `/health`, `/docs`, `/openapi.json`    | `live`, `ready`, Swagger UI                                                                                               | Public                                 |

---

## Data model and encryption

Mongoose registers 20 models in `apps/api/src/database/schemas/index.ts`:

| Area        | Models                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Identity    | `User`, `OAuthAccount`, `Session`, `VerificationToken`                                           |
| Workspace   | `Workspace`, `WorkspaceMember`, `Invitation`                                                     |
| Project     | `Project`, `ProjectMember`, `Environment`                                                        |
| Secrets     | `Secret`, `SecretValue`, `SecretHistory`                                                         |
| Operations  | `ServiceToken`, `AuditLog`, `Webhook`, `WebhookDelivery`, `ProcessedStripeEvent`, `Subscription` |
| Maintenance | `SchemaVersion`                                                                                  |

Notes on the schema:

- MongoDB ObjectIds are used internally; string IDs are exposed externally.
- Unique indexes enforce workspace slugs, project slugs per workspace, environment slugs per project,
  secret names per project, one value per secret/environment pair, and service-token hashes.
- TTL indexes expire sessions, tokens, invitations, audit records and processed Stripe events.
- `SecretValue` stores ciphertext, IV, auth tag, key ID and cipher version. There is no plaintext
  `value` field on any persisted model.
- `pnpm db:indexes` synchronizes indexes; schema drift is checked in CI by a schema-audit spec.

Envelope encryption lives in `apps/api/src/crypto`:

- AES-256-GCM with a fresh data encryption key per value and a 96-bit random IV.
- GCM additional authenticated data binds `workspaceId:projectId:environmentId:secretId`, so moving
  ciphertext to another secret or environment fails authentication.
- The KEK comes from `EnvKeyProvider` locally or `KmsKeyProvider` (AWS KMS) in production.
- Dual-read by `keyId` supports rotation; rotate re-encrypts values without changing their meaning.

---

## Dashboard deep dive

The dashboard is a Next.js 15 App Router application using React 19, Tailwind CSS 3, Radix UI
primitives, TanStack Query, React Hook Form and Zod. It is intentionally the last built layer, so it
is driven by real API responses rather than hardcoded fixtures.

### Main screens

| Area                      | Routes                                                                                                     | What works                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Landing/docs              | `/`, `/docs`, `/docs/cli`, `/docs/sdk`, `/docs/security`                                                   | Static product page and SDK/CLI guidance                         |
| Auth                      | `/auth/login`, `signup`, `verify`, `forgot-password`, `reset`                                              | Real signup, verification, login, reset                          |
| Invitations               | `/workspaces/invitations`                                                                                  | Accept/decline with session-aware states                         |
| Shell                     | `/dashboard`, `/workspaces/new`                                                                            | Workspace switcher, responsive navigation, theme toggle          |
| Hierarchy                 | `/workspaces/:id/projects`, `.../projects/:projectId`, `.../environments/new`, `.../duplicate`, `.../diff` | Create, archive, restore, duplicate, compare                     |
| Vault                     | `/workspaces/:id/secrets`, `.../new`, `.../edit`, `.../import`                                             | Masked table, reveal, search, import, browser-side `.env` export |
| History                   | `.../secrets/:secretId/history`                                                                            | Version timeline, diff and confirmed rollback                    |
| Team                      | `/workspaces/:id/members`, `.../projects/:projectId/members`                                               | Workspace/project roles, custom permissions, invites             |
| Credentials               | `.../projects/:projectId/credentials`                                                                      | Token creation, one-time reveal, rotate, revoke                  |
| Audit                     | `/workspaces/:id/audit`                                                                                    | Filterable audit viewer                                          |
| Webhooks/billing/settings | `.../webhooks`, `/billing`, `/settings`                                                                    | Signed endpoint management, Stripe checkout, workspace settings  |

### API client behavior

`apps/web/src/lib/api/client.ts` is the only browser transport:

- `credentials: 'include'` sends the httpOnly session cookies.
- A 401 triggers one silent refresh at `/auth/refresh`, then retries the original request once.
- Responses are returned as parsed JSON without an implicit `data` unwrap; each page must match the
  API response shape exactly. For example, export returns `{ entries }`, not a bare array.
- `ApiError` exposes status, message, code, field errors, `X-Request-Id` and rate-limit headers.

The auth provider guards public paths, loads `/auth/me`, and exposes workspace reload helpers. The
dashboard shell renders loading, empty and error states rather than placeholder data.

---

## SDK and CLI deep dive

### The published package

[`aegis-secrets` on npm](https://www.npmjs.com/package/aegis-secrets) is the distributable form of
`packages/sdk`. It ships ESM, CommonJS and TypeScript declarations, and installs two equivalent CLI
binaries: `aegis` and `aegis-secrets`. Source documentation is in
[packages/sdk/README.md](packages/sdk/README.md).

```bash
npm install aegis-secrets
# or: pnpm add aegis-secrets
# CLI on demand: npx aegis-secrets <command>
```

The package is server-only. It throws `AegisServerOnlyError` when loaded in a browser or bundler
client context, and it never receives key material or ciphertext.

### Programmatic usage

```ts
import { Aegis } from "aegis-secrets";

const aegis = new Aegis({
  projectId: process.env.AEGIS_PROJECT_ID!,
  environment: "production",
  apiKey: process.env.AEGIS_SERVICE_TOKEN,
  endpoint: process.env.AEGIS_API_URL, // optional
});

await aegis.inject(); // resolves secrets and writes them into process.env

const single = aegis.get("DATABASE_URL");
const all = aegis.getAll(); // frozen, read-only record
aegis.disconnect(); // purge in-memory values
```

| Method           | Behavior                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| `init(options)`  | Construct/configure the client and validate options                    |
| `sync(names?)`   | Resolve values into the in-memory cache without mutating `process.env` |
| `inject(names?)` | Resolve and assign values to `process.env`                             |
| `get(name)`      | Read one cached value                                                  |
| `getAll()`       | Read a frozen record of cached values                                  |
| `validate()`     | Check token/project/environment without exposing values                |
| `run(args)`      | Spawn a child with secrets in its environment and relay signals        |
| `disconnect()`   | Clear decrypted values from memory                                     |

Defaults: endpoint `AEGIS_API_URL` or `http://localhost:3001`, cache TTL 60 s, timeout 5 s, two
retries on 429/5xx. Secret names must match `^[A-Z_][A-Z0-9_]*$`.

### CLI usage

```bash
npx aegis-secrets login     # store token in the OS keychain
npx aegis-secrets init --project <projectId> --environment production --endpoint <url>
npx aegis-secrets validate
npx aegis-secrets run -- npm start
npx aegis-secrets pull --format env --name DATABASE_URL
npx aegis-secrets logout
```

Configuration precedence is flags, then environment variables, then the non-secret config file.
Tokens prefer `AEGIS_SERVICE_TOKEN`, then the OS keychain (`@napi-rs/keyring`). The config file stores
only `projectId`, `environment` and `endpoint`. `run` strips all `AEGIS_*` variables from the child
and refuses to override `PATH`, `NODE_OPTIONS`, `LD_PRELOAD` or `DYLD_INSERT_LIBRARIES`.

Errors inherit from `AegisError` with codes `SERVER_ONLY`, `CONFIG`, `INPUT`, `AUTHENTICATION`,
`RATE_LIMITED`, `NETWORK`, `RESPONSE` and `COMMAND`.

---

## Shared contracts

`packages/shared` is the single source of truth for cross-package shapes:

| File                            | Contents                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| `src/contracts/auth.ts`         | Signup, login, verify, reset and profile schemas           |
| `src/contracts/workspaces.ts`   | Workspace create/update, invitations, member views         |
| `src/contracts/projects.ts`     | Project/environment/member params and view types           |
| `src/contracts/secrets.ts`      | Secret CRUD, import/export, history, service-token schemas |
| `src/contracts/integrations.ts` | Billing and webhook schemas                                |
| `src/contracts/audit.ts`        | Audit query and view types                                 |
| `src/permissions.ts`            | Permission list and workspace/project role matrices        |

The API uses these schemas in validation pipes; the web uses the exported types for query results and
form values. Because the SDK speaks the runtime API, its response parsing follows the same
`{ entries }` convention as the export endpoint.

---

## Security invariants

These are non-negotiable for every change, summarized from [docs/PLAN.md](docs/PLAN.md):

1. Workspace is the tenant boundary; IDs never come from untrusted request bodies for authorization.
2. Deny by default; public routes are centralized in one allowlist.
3. Backend decrypts; the SDK receives plaintext only in process memory, never keys.
4. Service tokens are hashed, project/environment scoped, expiring and instantly revocable.
5. Secrets never appear in logs, traces, URLs, error responses, analytics or emails.
6. Non-development startup fails on missing config; no hardcoded key or actor fallbacks.
7. The SDK refuses to run in a browser or bundler client context.
8. The dashboard renders only API data; seed data is dev-only and labeled.
9. Every endpoint or permission change ships with a test proving cross-tenant denial.

Audit writes are awaited, and a failed audit write blocks the corresponding mutation. Pino redacts
authentication headers, cookies, bodies, queries, values, tokens and ciphertext paths.

---

## Testing and quality gates

```bash
pnpm typecheck       # build shared, then tsc --noEmit in every workspace
pnpm lint            # ESLint across the repository
pnpm test            # build shared, then Vitest in API/web/SDK
pnpm test:coverage   # API coverage with configured thresholds
pnpm test:e2e:list   # list Playwright specs without running a browser
pnpm test:sdk:pack   # pack the SDK and install it into a temporary sample app
pnpm load:test       # exercise /health/live against the built API
pnpm build           # build all packages and apps
```

Coverage thresholds are defined in `apps/api/vitest.config.ts`: global lines/statements 60%,
functions 50%, branches 60%; `auth` and `crypto` are stricter, and `authz` targets 80%. The web uses
Vitest with jsdom plus Testing Library; Playwright is configured for Chromium but the committed
smoke spec is currently skipped.

The load target from [docs/runbooks/load-test.md](docs/runbooks/load-test.md) is 50 concurrent
connections for 30 seconds against `GET /health/live`, requiring at least 200 requests/sec and p95
at or below 250 ms.

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, tests, coverage, e2e listing, build,
SDK pack verification and the load test on pushes to `master` and pull requests.

---

## Operations and runbooks

| Runbook                                                    | Use it when                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [deploy.md](docs/runbooks/deploy.md)                       | Planning deployment; currently documents the gap rather than a finished pipeline |
| [key-rotation.md](docs/runbooks/key-rotation.md)           | Rotating KEKs or secret values without data loss                                 |
| [incident-response.md](docs/runbooks/incident-response.md) | Suspected token compromise or secret exposure                                    |
| [load-test.md](docs/runbooks/load-test.md)                 | Reproducing the throughput and latency check                                     |

Operational notes:

- MongoDB must be a replica set; transactions are required for value + history + audit writes.
- Atlas should enforce encryption at rest, IP allowlists, PITR and environment-specific users.
- Redis supplies shared revocation/rate-limit state in production; local development can use the
  in-memory fallback.
- Rotation uses `keyId` dual-read, so keep old KMS key versions available until the cutover is done.
- Never paste a real service token, master key or secret value into an issue, log or commit.

---

## Current status and known gaps

Backend, API, SDK, CLI and hardening are complete through Phase 12. Dashboard sub-stages 1–8 are
implemented; sub-stage 9 (polish) remains. This is not yet production-ready.

Open items to resolve before sign-off:

- Keyboard navigation, focus management, ARIA labels, mobile review and empty-state copy need a
  final accessibility pass; Playwright e2e coverage is still a skipped smoke test.
- Live provider smoke tests for Resend, Stripe, Google OAuth, AWS KMS and OTEL/Sentry have not been
  exercised in CI.
- Rate-limit and abuse state is in-process today; multi-instance deployments need shared Redis
  enforcement.
- There is no container image or production deploy workflow yet; see the deploy runbook.
- Documentation naming is inconsistent: older pages say `aegis`, but the published npm package is
  `aegis-secrets`.
- `docs/PHASE-13-DASHBOARD.md` lags behind `docs/PHASE-LOG.md` on completed sub-stages.
- There is no `LICENSE` file or `license` field yet, although the SDK README shows an MIT badge.

Contributions should preserve the invariants above, keep changes API-backed, and add a cross-tenant
denial test whenever an endpoint or permission changes.

---

## Further reading

- [docs/PLAN.md](docs/PLAN.md) — phases, stack decisions and MongoDB data model.
- [docs/design.md](docs/design.md) — product design notes.
- [docs/PHASE-LOG.md](docs/PHASE-LOG.md) — what was built and how it was verified.
- [docs/PHASE-13-DASHBOARD.md](docs/PHASE-13-DASHBOARD.md) — dashboard sub-stage tracker.
- [packages/sdk/README.md](packages/sdk/README.md) — full SDK and CLI reference.
- [aegis-secrets on npm](https://www.npmjs.com/package/aegis-secrets) — published package.

No secrets, tokens or keys are included in this repository.
