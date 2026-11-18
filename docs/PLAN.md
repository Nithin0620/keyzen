# Aegis — MongoDB rebuild plan

## 0. Scope

Aegis is a cloud secrets manager with the hierarchy **User → Workspace → Project → Environment → Secret**, RBAC at workspace and project level, and a published `aegis` npm SDK/CLI that injects secrets into server-side Node processes at runtime.

The previous repository is archived and is **not** being reused. This document is the single source of truth for the rebuild. The dashboard is deliberately the **last phase** so it can be designed against a finished, real API with your review at every step.

---

## 1. Security invariants (apply to every phase)

1. **Workspace is the tenant boundary.** Every read and write is scoped by a `workspaceId` derived from a verified session or service token — never from a request body or query parameter.
2. **Deny by default.** A route is guarded unless it is explicitly listed as public in one place (health, auth endpoints, OAuth callback, Stripe webhook).
3. **Backend decrypts.** The SDK never receives key material. GCM AAD binds `workspaceId:projectId:environmentId:secretId` so ciphertext cannot be swapped between secrets, environments or projects.
4. **Service tokens** are scoped to one project + one environment, stored as hashes only, expire, and can be rotated/revoked immediately.
5. **Secrets never appear** in logs, traces, URLs, error responses, analytics or invitation emails. Audit writes are awaited, not fire-and-forget.
6. **No hardcoded fallbacks** for keys, credentials or actor identity outside development. Non-development startup fails fast on missing config.
7. **Server-only SDK.** `inject()` refuses to run in a browser/bundler client context.
8. **No fake data.** Every UI value comes from the API. Seed data is dev-only and clearly marked.
9. **Every endpoint and permission change ships with a test** proving cross-tenant access is denied.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | SDK and CLI publish independently of apps |
| API | Express 4 + TypeScript | Modular monolith, explicit route manifest, middleware guards, OpenAPI later |
| Web | Next.js 15 App Router + Tailwind + shadcn/ui + TanStack Query | Last phase, reviewed with you |
| Database | **MongoDB Atlas 8**, replicaset | Atlas gives transactions, PITR, encryption at rest, IP allowlist |
| ODM | Mongoose 8 directly | Strict schemas, validators, hooks; native driver for transactions |
| Cache | Redis via ioredis | Rate limits, revocation list, session cache |
| Auth | API-owned: argon2id, JWT access + refresh cookies, Google OAuth2, reset tokens | Single identity authority |
| RBAC | Permission matrix + Express middleware from route manifest | Workspace and project roles independent |
| Crypto | AES-256-GCM envelope, KMS provider interface, key IDs, rotation | `EnvKeyProvider` for dev, AWS/GCP KMS for prod |
| SDK/CLI | `aegis` TypeScript package, tsup ESM+CJS, Commander | `npm i aegis`, `npx aegis run -- npm start` |
| Contracts | Zod in `packages/shared` | One validation source for API, web, SDK |
| Email | Resend | Verification, reset, invites |
| Observability | Pino redaction + OpenTelemetry + Sentry | No secret values in any sink |
| Tests | Vitest + Supertest + Playwright | Unit, API integration, browser e2e |
| Billing | Stripe Checkout + signature-verified webhooks | Never a direct plan write |
| CI/CD | GitHub Actions + Docker | Typecheck, lint, test, build, image publish |

---

## 3. MongoDB data model

Use ObjectId for `_id`; expose string IDs externally. Every tenant-owned collection carries `workspaceId` and is always queried through a tenant-scoped repository.

| Collection | Key fields | Required indexes |
|---|---|---|
| `users` | email (unique, lowercase), name, passwordHash, emailVerifiedAt, status | `email` unique, `status` |
| `oauthaccounts` | userId, provider, providerUserId | `(provider, providerUserId)` unique, `userId` |
| `sessions` | userId, refreshTokenHash, expiresAt, revokedAt, userAgent, ipHash | `refreshTokenHash` unique, `userId`, TTL on `expiresAt` |
| `verificationtokens` | userId, tokenHash, type, expiresAt, usedAt | `tokenHash` unique, TTL on `expiresAt` |
| `workspaces` | name, slug, ownerId, description, settings | `slug` unique, `ownerId` |
| `workspacemembers` | workspaceId, userId, role | `(workspaceId, userId)` unique, `userId` |
| `invitations` | workspaceId, email, role, tokenHash, invitedBy, expiresAt, acceptedAt | `tokenHash` unique, `(workspaceId, email)`, TTL on `expiresAt` |
| `projects` | workspaceId, name, slug, description, archivedAt | `(workspaceId, slug)` unique, `workspaceId` |
| `projectmembers` | projectId, workspaceId, userId, role, customPermissions | `(projectId, userId)` unique, `userId`, `workspaceId` |
| `environments` | projectId, workspaceId, name, slug | `(projectId, slug)` unique, `projectId`, `workspaceId` |
| `secrets` | projectId, workspaceId, name, description | `(projectId, name)` unique, `workspaceId` |
| `secretvalues` | secretId, environmentId, workspaceId, ciphertext, iv, authTag, keyId, cipherVersion, valueVersion | `(secretId, environmentId)` unique, `environmentId`, `workspaceId` |
| `secrethistory` | secretId, environmentId, workspaceId, ciphertext, iv, authTag, keyId, valueVersion, changedBy | `(secretId, environmentId, valueVersion)` unique, `workspaceId` |
| `servicetokens` | projectId, environmentId, workspaceId, name, tokenHash, tokenPrefix, createdBy, status, expiresAt, lastUsedAt, revokedAt | `tokenHash` unique, `projectId`, `environmentId`, TTL on `expiresAt` |
| `auditlogs` | workspaceId, projectId, actorType, actorId, action, metadata, ipHash, userAgent, createdAt | `(workspaceId, createdAt)`, `(projectId, createdAt)`, TTL by retention |
| `webhooks` | projectId, workspaceId, url, events, secretHash, isActive | `workspaceId`, `projectId` |
| `subscriptions` | workspaceId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodEnd | `workspaceId` unique, `stripeCustomerId` unique |

**Mongo-specific rules**
- Mongoose `strict: true`, `runValidators: true`; reject keys starting with `$` and containing `.` from all user input to prevent operator injection.
- Multi-document writes (secret update + history insert + audit) use a Mongo transaction with an explicit session; requires a replica set (Atlas provides it).
- TTL indexes handle session/token/invitation expiry; never rely on cron alone.
- Atlas: encryption at rest, IP allowlist, VPC peering, PITR, separate dev/staging/prod clusters or databases.
- Never index secret values or metadata containing values; index names and IDs only.

---

## 4. Phases

### Phase 0 — Foundation and tooling
**Goal:** a clean, reproducible workspace with no product logic.
- Fresh root with pnpm workspace, base TS config, ESLint/Prettier, `.env.example`, strict env validation (Zod).
- Docker Compose: MongoDB replica set (single-node, for transactions), Redis, mailpit for dev email.
- `apps/api`, `apps/web`, `packages/shared`, `packages/sdk` skeletons; CI skeleton running typecheck/lint/test/build.
- Documented commands and contributor rules.
- **Done when:** `pnpm install && pnpm typecheck && pnpm lint && pnpm build` passes on a clean checkout; health endpoint responds; no product data exists.

### Phase 1 — Persistence layer and tenant scoping
**Goal:** every collection, validator and index exists and all access is tenant-scoped.
- Mongoose schemas for all 17 collections above with validators, enums and timestamps.
- Index creation script + schema versioning (`schemaVersion` collection, idempotent migration scripts).
- `TenantScopedRepository` base that requires `workspaceId` in every query; impossible to call without it.
- Transaction helper wrapping Mongo sessions; retry on transient transaction errors.
- Dev seed with clearly marked fake users/workspaces only.
- **Done when:** index/validator audit passes; a test proves a repository call without `workspaceId` throws; transaction rollback test passes.

### Phase 2 — Identity and authentication
**Goal:** real users and sessions, no impersonation.
- Signup with argon2id (email uniqueness, lowercase normalization), email verification, profile read/update.
- Login/logout; JWT access (15m) + refresh (30d) in httpOnly, Secure, SameSite cookies; refresh rotation with reuse detection and family revocation.
- Password reset via single-use hashed token + Resend.
- Google OAuth2 callback, account linking by verified email, oauthaccounts upsert.
- Rate limits on login, signup, reset, OAuth callback; generic error messages (no user enumeration).
- **Done when:** tests cover signup→verify→login→refresh→logout, reset flow, OAuth callback, reuse detection, and rate limiting; no password or token in logs.

### Phase 3 — Workspaces and invitations
**Goal:** users can own, switch and populate workspaces.
- Workspace create/update/delete (with explicit confirmation token), unique slug, settings.
- Member list, role change, removal, owner transfer; last-owner guard.
- Email invitations with hashed single-use token, expiry, accept/decline, revoke.
- Active workspace selection stored server-side per user, not in a client-controlled header.
- **Done when:** a user cannot act in a workspace they are not a member of; invitation tests cover expiry, reuse and revoke; deletion cascades are verified.

### Phase 4 — RBAC and policy engine
**Goal:** authorization is centralized and deny-by-default.
- Roles: workspace OWNER/ADMIN/MEMBER/VIEWER; project OWNER/ADMIN/DEVELOPER/VIEWER; plus custom permission sets on project membership.
- Permissions: `secrets.read`, `secrets.create`, `secrets.update`, `secrets.delete`, `secrets.export`, `environments.manage`, `members.invite`, `credentials.manage`, `audit.read`, `billing.manage`.
- Policy evaluator resolves: explicit project membership → project role → custom overrides → workspace role → deny. No implicit project access from workspace membership.
- `@RequirePermission` decorator + global guard; applied to every non-public route; public routes listed in one allowlist.
- **Done when:** a permission matrix test runs every role × every permission × every endpoint; all unauthorized cases return 403; no route is accidentally public (automated route audit).

### Phase 5 — Projects and environments
**Goal:** the full hierarchy is manageable.
- Project create/read/update/archive/delete, slug uniqueness per workspace, settings, activity summary.
- Environment create/read/update/delete, duplicate (copy all values, re-encrypt under new AAD), compare/diff between environments (names and masked values only).
- Project-level member assignment independent of workspace role.
- Soft-delete/archive with restore; hard delete requires explicit typed confirmation.
- **Done when:** cross-workspace project/environment IDs return 404; duplicate and diff never expose plaintext; archive prevents runtime resolution.

### Phase 6 — Secrets and encryption core
**Goal:** secrets are stored and retrieved securely.
- Secret CRUD with names, descriptions, masking and server-side search by name only.
- Bulk import from `.env` with size/count limits and strict parser; export gated by `secrets.export` and written only by the browser, never by the server.
- Envelope encryption: AES-256-GCM, 96-bit random IV, fresh DEK per value, KEK from KMS provider, stored `keyId`, `cipherVersion`, AAD binding workspace/project/environment/secret.
- `KeyProvider` interface with `EnvKeyProvider` (dev) and `KmsKeyProvider` (prod); master key required in non-dev.
- Key rotation plan: dual-read by `keyId`, background re-encrypt, cutover.
- **Done when:** ciphertext is unreadable without KEK; swapping a ciphertext between secrets/environments fails GCM auth; rotation test re-encrypts with no data loss; no value in logs/errors.

### Phase 7 — Versioning, rollback and audit
**Goal:** every change is attributable and reversible.
- `secrethistory` written in the same transaction as `secretvalues`; version numbers atomic via `$inc` with retry.
- One-click rollback creating a new version (never deleting history), with confirmation and audit entry.
- Audit log for every read/mutation of secrets, tokens, memberships, workspaces, billing; actor is real user or service token ID; IP stored as hash.
- Awaited audit writes; redaction middleware for Pino/OTel/Sentry; retention TTL configurable.
- **Done when:** rollback test verifies history preserved and audit actor correct; log scan finds zero secret values; failed audit write blocks the mutation.

### Phase 8 — Service credentials and runtime API
**Goal:** applications can resolve secrets safely.
- Token creation with project+environment scope, expiry, name, hashed storage (`ags_` prefix), one-time plaintext display.
- List (prefixes only), rotate, revoke; revocation cached in Redis for immediate effect.
- `POST /v1/secrets/resolve` with token auth, rate limiting, per-token audit, and only the token's environment returned.
- Validate endpoint for SDK/CLI; no secret values in validation responses.
- **Done when:** a token for env A cannot read env B; revoked token fails immediately; token hash never leaves DB; resolve is rate-limited and audited.

### Phase 9 — SDK (`aegis` npm package)
**Goal:** the core differentiator works in real apps.
- Public API: `init()`, `get()`, `getAll()`, `inject()`, `sync()`, `run()`, `validate()`, `disconnect()`.
- Config: `projectId`, `environment`, `apiKey` from `AEGIS_SERVICE_TOKEN`; endpoint override for self-hosting.
- In-memory cache with TTL, refresh-on-demand, explicit disconnect; no disk persistence of secrets.
- Server-only guard (`typeof window !== 'undefined'` throws); clear errors with no values.
- Timeouts, bounded retries with jitter, typed errors, ESM+CJS builds, published tarball test in a sample app.
- **Done when:** sample Express app starts with injected `process.env` values, no `.env` on disk, browser import fails clearly, and CI installs the packed tarball.

### Phase 10 — CLI
**Goal:** `npx aegis` works without leaking credentials.
- Commands: `init`, `pull`, `run`, `validate`, `login`, `logout`.
- Token from environment variable or OS keychain (keychain preferred); never a world-readable plaintext config file; tokens never in shell history or process args.
- `run -- <cmd>` spawns child with secrets in memory only; strips Aegis internal vars from child env; blocks overriding `NODE_OPTIONS`/`LD_PRELOAD`/`PATH` from stored secrets.
- Signal-exit propagation, timeouts, structured output for CI.
- **Done when:** `npx aegis run -- node app.js` works with no `.env`, token absent from `ps` output, and keychain storage verified on Linux/macOS/Windows fallback.

### Phase 11 — Integrations and background work
**Goal:** billing, notifications and outbound events are real.
- Stripe Checkout sessions, customer creation, subscription state changed **only** by signature-verified webhooks; plan status read from DB.
- Outbound webhooks with HMAC signing, event allowlist, URL validation blocking private IPs/metadata endpoints, retries with backoff and delivery log.
- Resend templates for verification, reset, invites, security alerts.
- Scheduled jobs: token expiry cleanup, key rotation, audit retention, stale invitation cleanup.
- **Done when:** forged webhook signatures rejected; billing state cannot be changed by any API call; webhook SSRF test blocked; all jobs have failure alerts.

### Phase 12 — Hardening, testing and observability
**Goal:** production-safe before any UI work.
- Global validation pipe (Zod), sanitized errors, security headers, CORS allowlist, TLS enforcement, request size limits.
- Rate limiting per IP and per token; abuse monitoring.
- Vitest unit + Supertest API integration + Playwright prepared; coverage thresholds on auth/RBAC/crypto.
- OpenAPI/Swagger docs generated from DTOs; Pino redaction, OTel traces, Sentry; health/readiness probes; runbooks for deploy, key rotation and incident response.
- **Done when:** full CI green; cross-tenant denial suite passes; secret-redaction test passes; load test meets target; deploy runbook reviewed.

### Phase 13 — Dashboard UI (last, built with you)
**Goal:** a polished, real-data dashboard reviewed step by step with you.

Sub-stages, each ending in your review before the next:
1. **Design system** — tokens, typography, dark/light theme, shadcn/ui primitives, accessible form and modal patterns.
2. **App shell** — auth pages, workspace switcher, navigation, responsive layout, loading/error/empty states.
3. **Projects & environments** — hierarchy navigation, create/archive/delete flows, duplicate and compare views.
4. **Vault** — table with masked values, reveal-on-demand with audit, search/filter, descriptions, `.env` import, permission-gated export.
5. **History & rollback** — version timeline, diff view, confirmed rollback.
6. **Team & RBAC** — workspace members, project members, role/custom permission editor, invitation flow.
7. **Service tokens** — create/rotate/revoke, prefix display, one-time token reveal, usage stats.
8. **Audit & settings** — filterable audit viewer, workspace settings, webhooks, billing via Stripe.
9. **Polish** — keyboard navigation, focus states, ARIA labels, empty/error states, mobile, performance, copy review.

**Done when:** every screen is API-backed, no hardcoded display data, all states designed, accessibility audit clean, and you sign off on each sub-stage.

---

## 5. Phase reporting

After each phase, append a 30–40 line entry to `docs/PHASE-LOG.md` using its template. It must record total files changed, the main work done, files touched, decisions, verification actually run, risks and carryover.

## 6. Definition of done for production

- [ ] Every endpoint has a test proving cross-tenant access is denied.
- [ ] No secret value appears in logs, traces, errors, URLs or emails.
- [ ] Key rotation works with zero data loss and is tested.
- [ ] Billing state changes only via verified Stripe webhooks.
- [ ] Tokens are hashed, scoped, expiring and instantly revocable.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes in CI.
- [ ] Dashboard has no fake data and passes accessibility checks.

## 7. Main risks

- **Mongo transactions require a replica set** — local dev must use one; never rely on standalone mongod for multi-document writes.
- **Schema drift** — Mongoose validators are not migrations; keep idempotent versioned scripts and an index audit in CI.
- **Operator injection** — strictly reject `$`-prefixed keys and dots in user input.
- **Atlas exposure** — enforce IP allowlist, dedicated users per environment, and no production credentials in developer `.env` files.
- **UI scope creep** — kept last intentionally; API and security must be stable before visual work begins.
