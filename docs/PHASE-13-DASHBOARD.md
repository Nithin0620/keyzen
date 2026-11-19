# Phase 13 — Dashboard delivery plan

- Status: in progress; date: 2026-11-19; subphase 1 approved.
- Parent plan: `docs/PLAN.md` → Phase 13, Dashboard UI.
- Delivery model: 8 subphases, consolidating the 9 PLAN.md sub-stages by merging audit/settings with final polish in subphase 8; each ends with user review before the next subphase starts.
- Commit model: one commit per subphase, using messages like `feat(web): implement Phase 13 subphase N <name>`.

## Global rules for every subphase

- Every screen must be API-backed. No hardcoded product data, placeholder records, or fake metrics.
- Use `@aegis/shared` Zod schemas and types where the API already defines them.
- The API is the authority for permissions. The UI may hide controls early, but must still handle 401/403 responses gracefully.
- Workspace and project IDs come from route params or verified API responses, never from request bodies.
- Secrets, tokens, webhook signing secrets, and reset/invite tokens never appear in URLs, browser storage, logs, analytics, or error messages. Reset, verify, invite, and billing callback tokens arrive in URL fragments (`#token=`), not query strings.
- Reuse the credentialed API client: `credentials: 'include'`, cookie-based auth via `aegis_access` and `aegis_refresh`, one refresh retry on 401, and explicit handling of `X-Request-Id`, `X-RateLimit-*`, and `Retry-After`.
- All destructive actions must surface the same typed confirmation the API requires.
- Every new UI behavior needs a test in the same change: Vitest component tests where useful, plus Playwright coverage for the critical flow.
- Update `docs/PHASE-LOG.md` after each completed subphase using the 30–40 line phase-report format.

## Current baseline

- `apps/web` is still a scaffold: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, and `src/lib/utils.ts`.
- Installed web dependencies include Next.js 15, React 19, Tailwind 3, `clsx`, `tailwind-merge`, `lucide-react`, Vitest, and Playwright.
- Missing UI foundations: shadcn/ui-compatible primitives, TanStack Query, form/validation helpers, table utilities, and theme tooling.
- The web app has no API base URL config and no proxy. Subphase 1 must add one, e.g. `NEXT_PUBLIC_API_URL` plus credentialed fetch.
- The API exposes all major route groups needed for the dashboard: auth, workspaces, projects, environments, secrets, history/rollback, members, invitations, credentials, webhooks, audit, and billing.
- Known API gaps to resolve or explicitly defer:
  - No dedicated endpoint for project `customPermissions` overrides. Team/RBAC subphase must either add a guarded endpoint with tests or show role-only controls.
  - No service-token usage-stats endpoint. Credentials subphase must either add a guarded endpoint with tests or omit usage stats.

## Subphase 1 — Design system and frontend foundation

### Goal

Establish the reusable visual language, primitives, and data layer that every later screen will use.

### Work

- Install and configure the chosen UI primitive stack, including shadcn/ui-compatible Radix primitives, class-variance utilities, and TanStack Query.
- Define design tokens in `globals.css` and Tailwind config: color, spacing, radius, typography, shadows, semantic success/warning/danger states, and light/dark themes.
- Build base primitives: button, input, textarea, select, checkbox, switch, dialog, sheet, dropdown menu, popover, tooltip, tabs, badge, card, table, skeleton, toast/alert, and form field wrappers.
- Add `NEXT_PUBLIC_API_URL`, a credentialed API client, typed error parsing, request-id capture, rate-limit header helpers, and a query-client provider.
- Add app-level error boundary, global loading shell, empty-state and error-state components, and a shared confirmation dialog.
- Reuse schemas from `@aegis/shared` for form validation instead of duplicating validation rules.

### Done when

- App builds and typechecks with the new foundation.
- Theme tokens and primitives are documented in the repo and used by the root layout.
- API client can call public endpoints such as `/health/live` and surface structured errors.
- No product screen has been built yet, and no fake product data exists.

### Review gate

User approves the visual language, theme behavior, component patterns, and API-client conventions before screens are built.

## Subphase 2 — Authentication and app shell

### Goal

Deliver real sign-in, account flows, route guards, and the dashboard frame around all future screens.

### Work

- Build auth routes: `/auth/login`, `/auth/signup`, `/auth/verify`, `/auth/forgot-password`, `/auth/reset`, and the Google OAuth entry point.
- Read verify/reset/invite tokens from URL fragments only; never move them into query strings or logs.
- Add a session provider backed by `GET /auth/me`, with one refresh retry on 401 and clean logout via `POST /auth/logout`.
- Build the dashboard shell: responsive sidebar, top bar, breadcrumbs, user menu, workspace switcher, skip link, and mobile navigation.
- Implement route guards that redirect unauthenticated users to login and preserve the intended destination.
- Wire workspace selection through `GET /workspaces`, `GET /workspaces/active`, and `POST /workspaces/:workspaceId/select`.
- Add out-of-band landing pages for `/workspaces/invitations#token=` and auth callback redirects from the API.

### Done when

- Signup → verify → login → logout works against the real API.
- Password reset, Google OAuth entry, and invite landing routes work without leaking tokens.
- Workspace switching changes server-side active workspace and updates the whole shell.
- Unauthenticated and forbidden states are clear and testable.

### Review gate

User reviews auth flows, shell layout, navigation behavior, and responsive states.

## Subphase 3 — Workspaces, projects, and environments

### Goal

Make the full tenant hierarchy manageable from the dashboard.

### Work

- Build workspace overview and basic workspace settings: read, update, and delete with typed confirmation.
- Build project list, create, read, update, archive, restore, and typed delete screens under `/workspaces/:workspaceId/projects`.
- Build environment list, create, read, update, archive, restore, and delete screens under a project.
- Build environment duplicate and masked compare/diff views.
- Surface resolve results only as masked or explicitly permitted values, never as plaintext in URLs.
- Add breadcrumbs and navigation that keep workspace/project/environment context explicit.

### Done when

- Cross-workspace or cross-project IDs produce clean 403/404 UI states rather than broken screens.
- Duplicate and diff never expose plaintext values.
- Archived projects/environments are visibly marked and unavailable for runtime-oriented actions.

### Review gate

User reviews hierarchy navigation, create/edit flows, archive/restore behavior, and diff presentation.

## Subphase 4 — Secrets vault

### Goal

Provide the primary day-to-day secret workflow with masked-by-default values and audited reveal.

### Work

- Build the vault table for a project: masked values, names, descriptions, environment filter, search by name, and pagination/limit handling.
- Build create, edit, delete, and value upsert flows for secrets and environments.
- Build reveal-on-demand using `GET /secrets/:secretId/reveal`, with a clear audit notice and automatic re-mask policy.
- Build `.env` import and permission-gated browser-side export; the server must not render secret values directly into export pages.
- Add key rotation action and surface version numbers after successful writes.
- Add permission-aware controls for `secrets.create`, `secrets.update`, `secrets.delete`, `secrets.export`, and `secrets.read`.

### Done when

- All secret values are masked by default.
- No secret value appears in URLs, browser storage, component state dumps, or error toasts.
- Reveal and export are audited by the API and visibly attributable in the UI.
- Import validation errors are readable and do not echo raw secret values.

### Review gate

User reviews vault table density, reveal behavior, import/export UX, and permission-gated controls.

## Subphase 5 — History and rollback

### Goal

Make every secret change attributable and reversible from the UI.

### Work

- Build version history timeline for a secret in one environment using `GET /secrets/:secretId/history`.
- Build masked diff views between versions, showing names and masked values only.
- Build rollback flow with version selection and typed confirmation.
- Show actor, timestamp, request id, and version number for each history entry where the API provides them.
- Handle long histories with limits/load-more behavior and clear empty states.

### Done when

- Rollback creates a new version and never deletes history.
- Rollback confirmations match API requirements and can be cancelled safely.
- All history and diff screens remain masked by default.
- Permission and audit failures are surfaced without raw error payloads.

### Review gate

User reviews timeline design, diff readability, rollback confirmation, and long-history behavior.

## Subphase 6 — Team, RBAC, and invitations

### Goal

Let workspace and project owners manage people and permissions safely.

### Work

- Build workspace member list, role change, removal, and owner transfer with typed confirmations.
- Build invitation create, list, revoke, accept, and decline flows.
- Build project member list, add, role change, and removal.
- Build a custom permission editor only if the API gap is resolved first; otherwise show role-only controls and document the deferral.
- Surface last-owner guards, expired/revoked invite states, and permission-denied states.
- Ensure invite links preserve fragment tokens through the whole accept/decline flow.

### Done when

- All member and invitation mutations are audited and attributable.
- Cross-workspace member IDs cannot be acted on from the UI.
- No token is moved from the URL fragment into query strings, logs, or analytics.
- The chosen custom-permission approach is explicit and tested.

### Review gate

User reviews member tables, invite UX, role editor, and whether custom permissions need an API follow-up.

## Subphase 7 — Service credentials, webhooks, billing, and settings

### Goal

Cover operational configuration: machine access, outbound events, plan state, and workspace preferences.

### Work

- Build service credential create, list, rotate, revoke, and one-time plaintext reveal using prefix-only list data.
- Add usage stats only if the API gap is resolved first; otherwise omit the feature rather than showing fake numbers.
- Build webhook create, list, rotate-signing-secret, deactivate, and delivery-log screens.
- Build workspace settings, billing overview, Checkout initiation, and `/billing/success?session_id=...` callback handling.
- Ensure billing state is read from the API only; never infer or write plan state client-side.
- Ensure webhook secrets are visible only once at creation/rotation and are never echoed from delivery logs.

### Done when

- One-time tokens and webhook secrets cannot be recovered from the UI after the reveal step.
- Revoked or rotated credentials immediately affect available actions.
- Billing success and cancellation states are API-verified where possible.
- No fake usage or billing data is displayed.

### Review gate

User reviews credential reveal UX, webhook delivery view, billing handoff, and settings layout.

## Subphase 8 — Audit, polish, accessibility, and sign-off

### Goal

Finish the dashboard with real audit visibility and production-quality interaction details.

### Work

- Build the audit viewer with filters for workspace, project, actor, action, and date range where supported by the API.
- Add keyboard navigation, focus states, ARIA labels, visible focus rings, and screen-reader-friendly loading/error/empty states.
- Review responsive behavior, mobile navigation, table overflow, touch targets, and modal focus trapping.
- Review performance: route-level code splitting, query caching, skeleton timing, and avoiding secret-value refetches.
- Copy review for all labels, confirmations, error messages, and help text.
- Enable and expand the existing Playwright smoke test into real authenticated flows using dev-only seed data or API-created test fixtures.
- Run full verification and update Phase 13 completion notes.

### Done when

- Every screen is API-backed and contains no fake display data.
- Accessibility checks are clean for all reviewed flows.
- Critical flows are covered by Playwright against real API behavior.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes, plus the Phase 13 e2e suite.
- User signs off on the completed dashboard.

### Review gate

Final user sign-off closes Phase 13. Any new API changes discovered during polish must become their own guarded, tested change before sign-off.

## Suggested status tracker

| Subphase | Name | Status | Review |
|---|---|---|---|
| 1 | Design system and frontend foundation | done | approved |
| 2 | Authentication and app shell | done | approved |
| 3 | Workspaces, projects, and environments | done | approved |
| 4 | Secrets vault | done | approved |
| 5 | History and rollback | done | approved |
| 6 | Team, RBAC, and invitations | done | approved |
| 7 | Service credentials, webhooks, billing, and settings | not started | pending |
| 8 | Audit, polish, accessibility, and sign-off | not started | pending |

Subphases 1 through 6 are implemented, verified, and approved; subphase 7 is unblocked.
