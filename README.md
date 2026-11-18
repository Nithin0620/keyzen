# Aegis

One secure place for all your project secrets.

This is a clean rebuild. The previous prototype is archived outside this repository; its code, schema and history are intentionally not carried over.

See [docs/PLAN.md](docs/PLAN.md) for the end-to-end build plan, tech decisions and security invariants.

## Layout

- `apps/api` — Express modular monolith (auth, RBAC, secrets, audit, billing)
- `apps/web` — Next.js dashboard
- `packages/shared` — Zod contracts and permission definitions
- `packages/sdk` — published `aegis` npm package and `npx aegis` CLI

## Getting started

```bash
cp .env.example .env
docker compose up -d
pnpm db:init
pnpm install
pnpm dev
```

Status: backend, API, SDK, CLI and hardening are complete through Phase 12. The dashboard is Phase 13 and has not started. Not production-ready until deployment review and live provider smoke tests pass.
