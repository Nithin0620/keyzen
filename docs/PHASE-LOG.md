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
