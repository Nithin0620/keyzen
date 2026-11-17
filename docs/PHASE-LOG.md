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
