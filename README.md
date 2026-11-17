# KeyZen

One secure place for all your project secrets.

This is a clean rebuild. The previous prototype is archived outside this repository; its code, schema and history are intentionally not carried over.

See [docs/PLAN.md](docs/PLAN.md) for the end-to-end build plan, tech decisions and security invariants.

## Layout

- `apps/api` — NestJS modular monolith (auth, RBAC, secrets, audit, billing)
- `apps/web` — Next.js dashboard
- `packages/shared` — Zod contracts and permission definitions
- `packages/sdk` — published `keyzen` npm package and `npx keyzen` CLI

## Getting started

```bash
cp .env.example .env
docker compose up -d
pnpm db:init
pnpm install
pnpm dev
```

Status: **Phase 0 — foundation**. Nothing here is production-ready yet.
