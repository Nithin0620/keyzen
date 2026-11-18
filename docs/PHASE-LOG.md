# Phase log

After every phase, append one entry below using the template. Each entry is 30–40 lines and records the total files changed, the main work done, decisions, verification, risks and carryover. This is a factual build log, not a marketing summary.

## Template

```markdown
## Phase N — Title

- Status: done / partial / blocked
- Date: YYYY-MM-DD
- Files created: N
- Files modified: N
- Files deleted: N
- Total files changed: N
- Tests added: N
- Verification command: <command>
- Verification result: pass / fail / not run

### Main thing done

One or two sentences describing the single most important outcome of the phase.

### Files touched

- `path` — what changed and why
- `path` — what changed and why

### Key decisions

- Decision and the reason behind it.
- Decision and the reason behind it.

### Verification

What was actually run and what it proved. Do not claim anything that was not run.

### Risks / issues found

- Risk or blocker and its proposed handling.

### Carryover to next phase

- Work intentionally left for the next phase.
```

## Phase 0 — Foundation

- Status: partial — written, not verified
- Date: 2026-11-17
- Files created: 36
- Files modified: 0
- Files deleted: 0
- Total files changed: 36
- Tests added: 0
- Verification command: none run
- Verification result: not run

### Main thing done

Replaced the stale Prisma-based prototype scaffold with a MongoDB foundation: Mongoose connection module, replica-set local database, strict env validation, shared Zod contracts and an empty SDK/CLI package skeleton. No product logic was implemented.

### Files touched

- `package.json` — workspace scripts, replaced Prisma DB commands with `db:init`.
- `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs` — monorepo and tooling config.
- `docker-compose.yml` — MongoDB 8 replica set `rs0` plus Redis 7, replacing PostgreSQL.
- `scripts/init-replica-set.sh` — idempotent replica-set initiation for local dev.
- `.env.example` — `MONGODB_URI` and all auth/crypto/email/billing variables, placeholders only.
- `apps/api/package.json` — swapped `@prisma/client`/`prisma` for `@nestjs/mongoose`/`mongoose`.
- `apps/api/src/config/env.ts` — Zod env schema, fails fast in production without a key provider.
- `apps/api/src/database/database.module.ts` — global Mongoose connection with retry.
- `apps/api/src/app.module.ts`, `main.ts`, `health.controller.ts` — wired database module and CORS.
- `apps/web/*` — Next.js shell with Tailwind and a placeholder home page.
- `packages/shared/*` — Zod auth/secret contracts and the permission matrix.
- `docs/PLAN.md` — 14-phase MongoDB rebuild plan.
- `docs/PHASE-LOG.md` — this log.

### Key decisions

- MongoDB requires a replica set for transactions, so local dev uses `--replSet rs0` and must run `pnpm db:init`.
- Replica member advertises `localhost:27017` so both the container and the host app can resolve it.
- Workspace is the tenant boundary; all future schemas will carry `workspaceId` and be queried through a scoped repository.
- Shared Zod contracts live in one package so API, web and SDK cannot drift.

### Verification

Nothing has been installed or executed. No typecheck, lint, build, database connection or test was run.

### Risks / issues found

- `packages/sdk` has no files yet; the package is not installable.
- `@nestjs/mongoose` version compatibility with NestJS 11 is unverified.
- The replica-set init script has not been executed against a running container.

### Carryover to next phase

- Run `pnpm install`, `pnpm typecheck`, `pnpm lint` and `pnpm build` to validate Phase 0.
- Create `packages/sdk` skeleton files.
- Begin Phase 1: all Mongoose schemas, indexes and the tenant-scoped repository base.

## Phase 1 — Persistence layer and tenant scoping

- Status: done
- Date: 2026-11-17
- Files created: 21
- Files modified: 5
- Files deleted: 0
- Total files changed: 26
- Tests added: 28 tests in 4 files
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Created the complete MongoDB persistence layer: 18 Mongoose models with strict schemas, validators and indexes, a repository base that makes tenant-scoped access mandatory, a transaction helper, an operator-injection guard, an index sync script and a development-only seed. This is the foundation every later phase builds on.

### Files touched

- `apps/api/src/database/schemas/*.ts` — all collections: identity, workspace, project, secret, operations and schema version.
- `apps/api/src/database/schemas/index.ts` — single model registry used by Nest and by scripts.
- `apps/api/src/database/tenant.repository.ts` — requires a valid `workspaceId` on every read and write and overrides any client-supplied scope.
- `apps/api/src/database/safe-input.ts` — rejects `$`-prefixed and dotted keys before they reach MongoDB.
- `apps/api/src/database/transaction.ts` — wraps Mongo `withTransaction` with guaranteed session cleanup.
- `apps/api/src/database/indexes.ts`, `seed.ts` — idempotent index sync and clearly marked development seed.
- `apps/api/src/database/database.module.ts` — registers all models globally.
- `apps/api/src/database/*.spec.ts` — tenant scoping, injection, transaction and schema/index audits.
- `packages/sdk/*` — Phase 0 carryover skeleton completed so workspace tooling resolves.
- `pnpm-workspace.yaml`, `package.json` — build approval and DB scripts.

### Key decisions

- `workspaceId` is required on every tenant-owned schema and is always injected by the repository, never accepted from callers.
- Unique compound indexes enforce slugs per parent and one current value per secret/environment.
- Multi-document writes go through a single transaction helper; retries are delegated to the driver.
- Schema correctness is tested offline by inspecting Mongoose index metadata, so CI needs no running database.

### Verification

Typecheck, lint, 28 unit tests and the full build all pass. The tests prove missing/invalid workspace scopes throw, client-supplied scopes are overridden, operator keys are rejected and sessions close on failure. No live MongoDB connection was exercised.

### Risks / issues found

- `pnpm approve-builds --all` was needed for esbuild; this is now persisted in `pnpm-workspace.yaml`.
- Next.js added `isolatedModules: true` to its tsconfig during build; strict mode remains inherited.
- Mixed fields (`settings`, `metadata`) are not deeply validated until boundary DTOs land.

### Carryover to next phase

- Run `docker compose up -d && pnpm db:init && pnpm db:indexes && pnpm db:seed` as a live smoke test.
- Phase 2: real users, sessions, Google OAuth, password reset and guarded auth routes.

## Phase 2 — Identity and authentication

- Status: done
- Date: 2026-11-17
- Files created: 14
- Files modified: 7
- Files deleted: 0
- Total files changed: 21
- Tests added: 9 tests in 2 files
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Implemented real identity and sessions: argon2id signup, verification/reset mail, JWT access cookies, rotating hashed refresh tokens with family revocation, Google OAuth linking, guarded profile routes and in-process rate limits.

### Files touched

- `apps/api/src/auth/**` — added controller, service, module, guard, JWT/token helpers, Google and mail services, rate limiter, types and two spec files.
- `apps/api/src/common/**`, `apps/api/src/app.module.ts`, `apps/api/src/config/env.ts`, `apps/api/src/database/schemas/identity.schema.ts`, `packages/shared/src/contracts/auth.ts`, `apps/api/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` — added validation/cookie helpers, wired the module, extended env and contracts, added `familyId`, and installed auth/test dependencies.

### Key decisions

- Refresh tokens are stored only as SHA-256 hashes; rotation revokes the previous token and reuse revokes the whole family in one Mongo transaction.
- Access tokens are 15-minute HS256 JWTs in httpOnly cookies; refresh tokens are 30-day cookies, Secure only in production, and mail links put tokens in the URL fragment so no token is sent in a query string.
- Email is normalized again inside the service, signup/reset responses are deliberately generic, and explicit `@Inject` decorators are used because Vitest/esbuild does not emit Nest constructor paramtypes metadata.

### Verification

Typecheck, lint, 37 tests and the full build pass; after fixing one unused-variable warning, `pnpm lint && pnpm --filter @aegis/api test` passed again. Tests cover signup→verify→login→refresh→reuse→logout, reset, OAuth linking, generic responses, every endpoint and route rate limiting. No live MongoDB, Resend or Google endpoint was exercised.

### Risks / issues found

- Rate-limit buckets are in-process only and must move to Redis before multi-instance deployment.
- Auth events are not yet written to `auditlogs`; that is intentionally deferred to Phase 7, and Google/Resend credentials are not configured locally.

### Carryover to next phase

- Run the live database smoke test and exercise a real Resend/Google configuration in staging.
- Phase 3: workspaces, invitations, member roles and server-side active workspace selection.

## Phase 3 — Workspaces and invitations

- Status: done
- Date: 2026-11-17
- Files created: 8
- Files modified: 6
- Files deleted: 0
- Total files changed: 14
- Tests added: 9 tests in 2 files
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Implemented tenant workspaces: owner-created workspaces, unique slugs, settings, membership roles, server-side active workspace, explicit-confirmation deletion, and hashed single-use email invitations.

### Files touched

- `apps/api/src/workspaces/**` — added the service, access guards, controller, module, types and both spec files.
- `packages/shared/src/contracts/workspaces.ts`, `packages/shared/src/index.ts`, `apps/api/src/app.module.ts`, `apps/api/src/database/schemas/{identity,workspace}.schema.ts`, `apps/api/src/auth/{mail.service,auth.module}.ts` — added contracts, active workspace state, invitation state, invite mail and module wiring.

### Key decisions

- Workspace access is checked server-side on every route via `WorkspaceAccessService`; active workspace is a verified user field, never a request body value.
- Invitation tokens are 32-byte random values hashed with SHA-256 in the invitation record; links use URL fragments, and accept/decline enforce email, pending status, expiry and single use.
- Deletion requires exact slug confirmation and runs all tenant-child deletes in one Mongo transaction; unsafe settings keys are rejected before persistence.

### Verification

Typecheck, lint, 46 tests and the full build pass. Tests cover non-member denial, active workspace selection, role change/removal/owner transfer, last-owner guard, invite hashing and expiry/reuse/decline/revoke, deletion cascade and every controller route. No live MongoDB or Resend delivery was exercised.

### Risks / issues found

- Deletion cascade is verified with fake models; live referential integrity should be smoke-tested against Atlas with indexes.
- Invitation delivery uses the dev outbox because Resend credentials are not configured; rate limits remain in-process.

### Carryover to next phase

- Run the live database smoke test and confirm compound tenant indexes for workspace-scoped collections.
- Phase 4: centralized RBAC and policy engine.

## Phase 4 — RBAC and policy engine

- Status: done
- Date: 2026-11-17
- Files created: 11
- Files modified: 4
- Files deleted: 0
- Total files changed: 15
- Tests added: 14 tests in 4 files
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Centralized authorization in a deny-by-default policy guard with a single public route allowlist, a `@RequirePermission` decorator, role resolution, project-level overrides and an automated route audit.

### Files touched

- `apps/api/src/authz/**` — added the policy service, global guard, decorator, route-key helpers, public allowlist, module and four spec files.
- `apps/api/src/app.module.ts`, `apps/api/src/auth/{jwt-auth.guard,auth.controller}.ts`, `apps/api/src/workspaces/workspaces.controller.ts`, `apps/api/src/auth/request-token.ts` — registered the global guard, annotated protected routes and shared token extraction.

### Key decisions

- Project-scoped decisions require explicit project membership; workspace roles are checked for presence only and never grant project access by themselves.
- Project role permissions are resolved first, then custom overrides where `+permission` grants, `-permission` revokes and unknown values are ignored; workspace role permissions apply only to workspace-scoped routes.
- Non-public routes without permission metadata are denied, and the public allowlist is checked by an automated audit for stale and unannotated routes.

### Verification

Typecheck, lint, 60 tests and the full build pass. Tests cover workspace and project role matrices, custom overrides, inactive users, invalid ids, cross-workspace project ids, no-membership denial, public route bypass, missing metadata, 401/403 handling and every existing endpoint's metadata. No live MongoDB was exercised.

### Risks / issues found

- Custom override syntax is interpreted in the policy service but has no boundary schema until project assignment routes land in Phase 5.
- Authenticated-only workspace routes still rely on the workspace service for membership checks; the global guard enforces authentication and permission metadata for them.

### Carryover to next phase

- Run a live smoke test for project membership indexes and override storage.
- Phase 5: projects, environments and scoped project member assignment.

## Phase 5 — Projects and environments

- Status: done
- Date: 2026-11-17
- Files created: 10
- Files modified: 6
- Files deleted: 0
- Total files changed: 16
- Tests added: 11 tests in 4 files
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Implemented the full project hierarchy: tenant-scoped projects, environments, project members with custom permissions, archive/restore, typed hard deletes, encrypted environment duplication and masked diffs.

### Files touched

- `packages/shared/src/contracts/projects.ts`, `packages/shared/src/index.ts`, `apps/api/src/database/schemas/project.schema.ts`, `apps/api/src/app.module.ts`, `apps/api/src/authz/*` — added contracts, schema state, module wiring and route-audit coverage.
- `apps/api/src/projects/**`, `apps/api/src/crypto/**`, `apps/api/src/database/schema-audit.spec.ts` — added access/service/controller/module code, AAD-bound AES-GCM duplication support and specs.

### Key decisions

- Every project and environment lookup is scoped by verified `workspaceId`, so cross-workspace ids return 404; project membership remains explicit and independent of workspace role.
- Archive uses `archivedAt` and blocks runtime resolution; hard delete requires the exact slug and removes all child records in one Mongo transaction.
- Duplicated values are decrypted and re-encrypted under the new environment AAD; diffs decrypt server-side and return only masked values and change status.

### Verification

Typecheck, lint, 71 tests and the full build pass. Tests cover project/environment CRUD and 404s, archive blocking resolution, typed delete cascades, project role assignment, last-owner guards, AAD binding, re-encryption on duplicate and plaintext-free diffs. No live MongoDB was exercised.

### Risks / issues found

- `ValueCipherService` is a focused bridge for duplication; Phase 6 must replace it with the full `KeyProvider`, KMS and rotation design.
- Schema changes add `settings` and `archivedAt` fields; indexes and live data need staging verification before production.

### Carryover to next phase

- Run the live database smoke test for new fields, tenant indexes and project membership overrides.
- Phase 6: secrets CRUD, envelope encryption, key providers and rotation.

## Phase 6 — Secrets and encryption core

- Status: done
- Date: 2026-11-17
- Files created: 19
- Files modified: 15
- Files deleted: 0
- Total files changed: 34
- Tests added: 17 tests in 7 files
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Implemented secrets CRUD, name-only search, strict `.env` import, caller-side export, envelope encryption with real Dev/KMS key providers, legacy dual-read and project key rotation.

### Files touched

- `apps/api/src/crypto/**`, `apps/api/src/config/env.ts`, `.env.example`, `apps/api/package.json`, `pnpm-lock.yaml` — added key providers, AES-GCM envelope cipher, KMS SDK, env validation and crypto module.
- `apps/api/src/secrets/**`, `packages/shared/src/contracts/secrets.ts`, `apps/api/src/database/schemas/secret.schema.ts`, `apps/api/src/projects/**`, `apps/api/src/authz/*` — added routes, contracts, schema fields, rotation and updated project duplication/diff to envelope cipher.

### Key decisions

- Each value gets a fresh 32-byte DEK and 96-bit IV; the DEK is wrapped by `EnvKeyProvider` in dev or AWS KMS in prod, with `keyId`, `cipherVersion`, wrapped-DEK fields and AAD binding workspace/project/environment/secret.
- Reads select by `keyId`/`cipherVersion`; legacy v1 values remain readable and rotation re-encrypts them into v2 with the target key id.
- Lists and gets return only masked values; reveal and export are explicit backend reads, while the server never writes `.env` files.

### Verification

Typecheck, lint, 88 tests and the full build pass. Tests cover AAD swaps, fresh DEKs, KMS generate/decrypt, legacy dual-read, rotation without data loss, strict `.env` limits, search, masking, tenant scoping, typed delete and every new route. No live MongoDB or AWS KMS was exercised.

### Risks / issues found

- KMS requires `AWS_REGION`, `AEGIS_KMS_KEY_ID` and AWS credentials in production; no fake fallback was added.
- Rotation is implemented as a guarded endpoint/service but not scheduled as background work; Phase 11 should wire the worker and cutover policy.

### Carryover to next phase

- Add secret history, rollback and awaited audit attribution in the same transactions as value writes.
- Run live staging tests for KMS, rotation and new wrapped-key fields.

## Phase 7 — Express backend migration

- Status: done
- Date: 2026-11-17
- Files created: 6
- Files modified: 41
- Files deleted: 11
- Total files changed: 58
- Tests added: 0 new test files; 6 controller/authz specs rewritten
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Replaced the NestJS backend with a plain Express 4 app while preserving all 59 HTTP routes and the full product behavior. Kept Next.js, MongoDB/Mongoose, Zod, Argon2/JWT, KMS and the shared contracts; Nest framework, CLI, testing, decorators, modules and global guard are gone.

### Files touched

- `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/api/src/container.ts`, `apps/api/src/http/**`, `apps/api/src/common/http-error.ts` — Express bootstrap, CORS, JSON body parsing, manual DI container, route registration, async error handling and local HTTP exception classes.
- `apps/api/src/authz/route-manifest.ts`, `apps/api/src/authz/public-routes.ts`, `apps/api/src/authz/route-key.ts`, `apps/api/src/authz/require-permission.decorator.ts` — explicit route manifest replaces Reflector metadata; deny-by-default remains enforced at registration.
- `apps/api/src/auth/**`, `apps/api/src/workspaces/**`, `apps/api/src/projects/**`, `apps/api/src/secrets/**`, `apps/api/src/health/**`, `apps/api/src/crypto/**`, `apps/api/src/database/**`, `apps/api/package.json`, `pnpm-lock.yaml`, `README.md`, `docs/PLAN.md` — controllers became route factories, services became plain classes, Nest dependencies/config were removed and Express was documented.

### Key decisions

- Every route is declared once with method, full path, name and either `public: true` or a permission requirement; registration throws on public-allowlist mismatch and on missing permission metadata.
- Ten authenticated-but-unscoped routes use the `AUTHENTICATED` sentinel; 39 scoped routes keep their original permissions; 10 routes remain public.
- Zod validation moved to middleware; JWT auth and policy evaluation moved to per-route middleware; exceptions map through one Express error handler. Constructor injection was replaced by explicit construction in `createContainer()` and direct Mongoose model registration.

### Verification

Typecheck, lint, 84 tests across 20 API test files and the full build pass. The count dropped from 88 because the deleted Nest `policy.guard.spec.ts` was replaced by route-manifest audits and the existing policy/permission-matrix coverage. Controller specs now drive real Express apps with Supertest, signed access tokens and stubbed services; auth cookies, RBAC denial, status codes, validation and rate limits still pass. No live MongoDB or AWS KMS was exercised.

### Risks / issues found

- CORS now sends one configured origin string from `WEB_ORIGIN`; multi-origin wildcard/reflector behavior was never in scope and remains unsupported.
- Swagger/OpenAPI was listed in the old Nest stack row but was never implemented; `require-permission.decorator.ts` remains a small re-export shim until imports are updated.

### Carryover to next phase

- Continue with the original Phase 7 audit/hardening work against the Express route manifest and re-run live staging checks for Atlas, KMS, cookies and CORS before exposing the API publicly.

## Phase 7 — Versioning, rollback and audit

- Status: done
- Date: 2026-11-18
- Files created: 10
- Files modified: 21
- Files deleted: 0
- Total files changed: 31
- Tests added: 4 new test files; 13 new tests
- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass

### Main thing done

Implemented the original Phase 7 plan against the Express route manifest. Secret value writes now increment versions atomically, write immutable history rows in the same Mongo transaction, and emit transaction-scoped audit records. Added confirmation-gated rollback and read-only history/audit endpoints with tenant and permission guards.

### Files touched

- `apps/api/src/secrets/secrets.service.ts`, `apps/api/src/secrets/secrets.controller.ts`, `apps/api/src/secrets/types.ts`, `packages/shared/src/contracts/secrets.ts` — `$inc` versioning with duplicate-key retry, history writes, rollback, history query and typed contracts.
- `apps/api/src/audit/**`, `apps/api/src/http/router.ts`, `apps/api/src/authz/route-manifest.ts`, `apps/api/src/app.ts`, `apps/api/src/container.ts` — awaited audit middleware, actor context, redacted metadata, real actor ids, hashed IPs and workspace-scoped audit reads.
- `apps/api/src/common/redact.ts`, `apps/api/src/logging/logger.ts`, `apps/api/src/config/env.ts`, `apps/api/src/database/indexes.ts`, `.env.example` — shared redaction helper, Pino sink with redaction, `AUDIT_RETENTION_DAYS` and configurable TTL index creation.

### Key decisions

- `auditedRoute()` marks every secrets, workspaces, projects and audit route as `read` or `write` in the manifest; audit is applied after auth, validation and policy checks.
- Write audits are awaited before handlers run, so an audit failure returns `500` and blocks the mutation. Read audits are awaited before the response is sent.
- Service-level value-change audits use the same Mongo session as `secretvalues` and `secrethistory`; history reuses stored ciphertext and never rewrites plaintext.
- Rollback creates a new version by copying the selected history row's encrypted payload; old history is never deleted or edited.

### Verification

Typecheck and lint pass. API tests pass with 97 tests across 24 test files, including rollback history preservation, actor attribution, redaction, failed-audit blocking and log-sink scanning. Full workspace build is included in the final verification command.

### Risks / issues found

- OTel and Sentry are not installed; `redactSensitive()` and the Pino redaction config are the only sink protections wired today.
- Service-token actors are represented in the audit schema and context type, but Phase 8 must wire them into authentication before they can appear in real audit rows.
- Audit TTL is configured at index sync time, so existing deployments must rerun `pnpm db:indexes` after setting `AUDIT_RETENTION_DAYS`.

### Carryover to next phase

- Implement Phase 8 service credentials and the runtime resolve API with `ags_` tokens, hash-only storage, one-time display, expiry, revocation and per-token audit.
- Ensure token authentication populates `SERVICE_TOKEN` audit actors and that resolve requests inherit the same redaction and tenant scoping rules.
- Run live staging checks for Mongo transactions, audit TTL indexes, KMS, cookies and CORS before exposing the API publicly.

## Phase 8 — Service credentials and runtime API

- Status: done; date: 2026-11-18.
- Files: 9 created, 20 modified, 29 total; 4 new test files with 15 new tests.

### What changed

- Added scoped `ags_` service tokens with SHA-256 hash-only storage, one-time plaintext display, prefix-only listing, expiry, rotation and revocation.
- Added `ServiceTokenService` authentication with revocation-cache checks, `lastUsedAt` updates, active/status/expiry validation and immediate old-hash invalidation on rotate/revoke.
- Added Redis revocation cache for production and in-memory fallback for local/test; auth fails closed when Redis rejects a revocation check.
- Added bearer-token request authentication and attached token identity for audit attribution without cookie fallback.
- Added credential-management create/list/rotate/revoke routes under project scope, guarded by `credentials.manage` and audited.
- Added `POST /v1/secrets/resolve` with per-token rate limiting, token-derived tenant/project/environment scope, optional name filtering and per-call audited reads.
- Added `GET /v1/validate` for SDK/CLI startup checks; response exposes only token scope and expiry, never secrets or hashes.
- Added `RouteAuth` to the central manifest and wired service-token auth through the Express router with `SERVICE_TOKEN` audit actors.
- Added `ProjectAccessService.requireEnvironmentScope()` while preserving existing archived-environment behavior for project management flows.
- Added `SecretsService.resolve()` and `SecretsService.validate()` that decrypt only values bound to the token environment.
- Added shared contracts for token creation, rotation, ID params, secret resolution and runtime validation.
- Added `SERVICE_TOKEN_RATE_LIMIT` and `SERVICE_TOKEN_RATE_WINDOW_MS` with 60 requests per 60 seconds defaults.
- Wired Redis, revocation cache and service-token DI into the container, app, router, startup and shutdown paths.
- Updated controller specs for expanded route dependencies and added coverage for tokens, revocation, runtime resolve, rate limiting and audit metadata.

### Verification

- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Verification result: pass
- Typecheck, lint and full workspace build pass.
- API tests pass with 112 tests across 28 test files, including hash non-disclosure, environment isolation, revoked-token rejection, rotate invalidation, rate limiting and service-token audit actors.
- Runtime route audit coverage confirms only `/v1/secrets/resolve` and `/v1/validate` use service-token auth.

### Risks / issues found

- Rate limiting remains in-process; multi-instance deployments need a shared Redis-backed limiter before public rollout.
- Redis revocation is enabled only in production; local/test use an in-memory cache, so horizontal scaling outside production would not share revocations.
- Mongo TTL cleanup can remove expired token documents; audit actor IDs remain traceable through audit rows.

### Carryover to next phase

- Implement Phase 9 SDK/CLI against the runtime API; do not start it in this change.
- Keep service-token plaintext out of SDK logs, shell history and persisted config; run staging checks for Redis revocation, production rate limiting and KMS before public exposure.

## Phase 9 — SDK (`aegis` npm package)

- Status: done; date: 2026-11-18.
- Files: 4 created, 5 modified, 9 total; 1 new test file with 9 new tests.

### What changed

- Implemented `Aegis` with `init()`, `get()`, `getAll()`, `inject()`, `sync()`, `run()`, `validate()` and `disconnect()`.
- Added config for `projectId`, `environment`, optional `apiKey`, `AEGIS_SERVICE_TOKEN`, endpoint override and cache/timeout/retry tuning.
- Added module-level and method-level server-only guard that fails browser imports with a clear typed error.
- Added in-memory TTL cache with no disk persistence, snapshot copies for `getAll()`, explicit `disconnect()` and refresh-on-demand through `sync()`.
- Added `init()` that validates the token and loads secrets, and `inject()` that copies fetched secrets into `process.env` in memory only.
- Added `run()` that spawns a child with injected secrets, strips `AEGIS_*` variables and blocks `NODE_OPTIONS`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` and `PATH` from stored secrets.
- Added timeouts, bounded retries with jitter, no retry on rejected tokens and typed errors with messages that never include secret values.
- Added strict endpoint validation requiring http/https URLs without embedded credentials.
- Added strict response validation for resolve and validate payloads, including uppercase secret-name enforcement.
- Added `@types/node` to the SDK so declaration builds include Node runtime types.
- Added a packed-tarball verification script that builds, packs, installs into a temporary sample app, imports ESM and CJS entrypoints and asserts no `.env` file is created.
- Added the packed-tarball check to CI after the full build.

### Verification

- Verification command: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:sdk:pack`
- Verification result: pass
- Typecheck, lint and full workspace build pass.
- SDK tests pass with 9 tests covering injection, TTL cache, token absence, auth rejection, bounded retries, unsafe names, child env stripping and browser import failure.
- API tests remain green at 112 tests across 28 test files; full workspace total is 121 tests.
- Packed tarball installs in a temporary sample app with working ESM/CJS imports and no `.env` file on disk.

### Risks / issues found

- SDK retries are local to the process; server-side rate limiting remains the authoritative protection for token abuse.
- `run()` forwards SIGINT/SIGTERM but does not yet implement Windows signal semantics beyond normal child exit handling.
- Validation checks project scope; environment identity remains token-scoped because the SDK config may use an environment label.

### Carryover to next phase

- Implement Phase 10 CLI only after explicit continuation; CLI commands remain Phase 10 placeholders.
- Keep tokens out of shell history and process arguments; prefer OS keychain storage with a safe non-production fallback before implementing `login`/`logout`.
