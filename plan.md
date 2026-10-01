# Keyzen — Architectural Fix Plan

A prioritized list of issues found during the architectural review, grouped by severity.

---

## 🔴 Critical

### 1. No real user authentication on the dashboard
**Problem:** `auth.ts` reads `x-user-id` and `x-user-email` as plain HTTP headers with hardcoded fallbacks. Anyone can send arbitrary headers and impersonate any user. No JWT, no Supabase Auth, no sessions.

**Fix:** Integrate Supabase Auth (or another auth provider). Validate a signed JWT on every request. Extract `userId` and `userEmail` from the verified token payload, never from raw headers.

---

### 2. Zero authorization in GraphQL resolvers
**Problem:** `revealSecret`, `createServiceToken`, `deleteSecret`, and all other mutations/queries perform no ownership or membership checks. Any request — authenticated or not — can read or modify any org/project in the database.

**Fix:** Add a membership guard before every resolver that touches project or org data. Check that the calling `userId` exists in `org_members` with a role that permits the action. Throw a forbidden error otherwise.

---

### 3. Web UI is entirely mock/fake data
**Problem:** Both `apps/web/src/app/page.tsx` and `apps/web/src/app/projects/[projectSlug]/page.tsx` populate data via hardcoded `useState`. The Apollo client is wired up but never called. "Add Secret" and "Generate Token" modals only update local React state — nothing persists to the API.

**Fix:** Replace all mock `useState` initializations with real Apollo `useQuery` and `useMutation` calls against the existing GraphQL schema. The schema already supports everything the UI needs.

---

### 4. Cloudflare Worker GraphQL skips auth entirely
**Problem:** `apps/api/src/worker.ts` hardcodes `userId: 'cf-worker-user'` in the GraphQL Yoga context regardless of what headers arrive. The REST `/api/v1/secrets/resolve` endpoint in the same file does proper token hash verification, but the management GraphQL does not.

**Fix:** Apply the same JWT/header validation logic to the worker's GraphQL context builder that will be used in the Fastify server (see issue #1). Share the auth logic in a package-level utility so both runtimes stay in sync.

---

## 🟡 Moderate

### 5. CORS is wide open in the Cloudflare Worker
**Problem:** `wrangler.jsonc` sets `CORS_ORIGINS: "*"`, meaning the worker accepts cross-origin requests from any domain in production. The Fastify server correctly restricts origins via the `CORS_ORIGINS` env var.

**Fix:** Replace `"*"` with the actual production dashboard origin (e.g. `https://keyzen.dev`). Wire it through a Wrangler secret or env var so it's configurable per deployment.

---

### 6. N+1 query on `Environment.secretCount`
**Problem:** The `Environment.secretCount` resolver fetches all matching `secret_values` rows into memory and returns `.length`. This fires one query per environment per request.

**Fix:** Replace with a single `SELECT COUNT(*) FROM secret_values WHERE environment_id = $1` query using Drizzle's `count()` helper.

---

### 7. Dynamic import inside a hot-path function
**Problem:** `getOrgIdByProjectId()` in `apps/api/src/routes/runtime-secrets.ts` calls `await import('@keyzen/db')` at runtime on every audit log write, even though the `projects` table is already available via a static import at the top of the file.

**Fix:** Move `projects` to the static imports at the top of `runtime-secrets.ts` and remove the dynamic import entirely.

---

### 8. No actual secret version history
**Problem:** `updateSecretValue` increments the `version` integer but overwrites the same `secret_values` row in-place. Previous ciphertext is permanently destroyed. The `version` column implies a history exists, but it doesn't.

**Fix:** Either (a) insert a new `secret_values` row per version and add a `is_current` flag or a separate `current_version` pointer, or (b) introduce a `secret_value_history` table to archive old versions before overwriting. Choose based on whether point-in-time rollback is a desired feature.

---

### 9. Weak master key default accepted silently in all environments
**Problem:** `apps/api/src/config.ts` defaults `KEYZEN_MASTER_KEY` to a hardcoded dev string. Zod's `.default()` silently accepts this in staging or production if the env var is missing. Secrets encrypted with the dev key in staging are silently unrecoverable if the key later changes.

**Fix:** Remove the `.default()` on `KEYZEN_MASTER_KEY` — make it a required field in production/staging. Add a startup check that rejects the known dev default string if `NODE_ENV !== 'development'`. Consider logging a warning in dev so the issue is visible.

---

## ✅ What's Already Solid (Don't Break These)

- **Crypto layer:** HKDF-SHA256 key derivation, 96-bit IVs, GCM auth tags, `projectId` bound as AAD — correct.
- **Service token auth:** Hash-only storage (`SHA-256`), `kzn_` prefix detection, expiry validation, async `lastUsedAt` update — correct.
- **DB schema design:** Separating `secrets` (key names) from `secret_values` (per-env ciphertext) is clean and extensible.
- **SDK in-memory cache:** TTL-based cache with `forceRefresh` option is the right pattern for zero-disk injection.
- **Postgres client config:** `prepare: false` is required for Supabase transaction pooler (port 6543) — keep this.
