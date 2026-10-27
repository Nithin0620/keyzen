# 🔐 Keyzen

> **Developer-First Secrets Management Platform**  
> Zero-Disk secret injection, AES-256-GCM envelope encryption, Next.js 14 Management Dashboard & Runtime API, Supabase PostgreSQL, and official zero-disk CLI.

---

## 🏗 System Architecture

```text
┌──────────────────────────────────────────────┐
│           Keyzen Full-Stack App              │
│       (Next.js 14 + Tailwind CSS)            │
│                                              │
│  ├── /dashboard       (Management UI)        │
│  └── /api/v1/resolve  (CLI Injection API)    │
└───────────────────────┬──────────────────────┘
                        │
             Envelope Cryptography
                 (AES-256-GCM)
                        │
             ┌──────────▼──────────┐
             │ Supabase PostgreSQL │
             │  (Ciphertext + IV)  │
             └─────────────────────┘
                        ▲
                        │ Zero-Disk Runtime Resolution
                        │
             ┌──────────┴──────────┐
             │     Keyzen CLI      │
             │ `keyzen run -- ...` │
             └─────────────────────┘
```

---

## 📦 Simple Folder Structure

```text
keyzen/
├── app/
│   ├── dashboard/page.tsx         # Projects overview dashboard
│   ├── dashboard/[projectId]/     # Secrets & Service Tokens management
│   ├── api/
│   │   ├── projects/route.ts      # Projects CRUD
│   │   ├── secrets/route.ts       # Secrets CRUD
│   │   ├── tokens/route.ts        # Service token issuance
│   │   └── v1/resolve/route.ts    # Fast CLI zero-disk secret resolution
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── db.ts                      # PostgreSQL connection (Drizzle ORM)
│   ├── schema.ts                  # Relational schema matching Supabase tables
│   └── crypto.ts                  # AES-256-GCM envelope encryption & HKDF
├── cli/
│   └── index.mjs                  # Zero-dependency zero-disk CLI tool
├── .env                           # DATABASE_URL + KEYZEN_MASTER_KEY
├── package.json                   # Single unified package.json
└── tsconfig.json
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Create `.env`:
```env
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require
KEYZEN_MASTER_KEY=keyzen_dev_master_key_must_be_32_bytes_or_more_secure!
```

### 3. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Keyzen dashboard.

---

## 💻 Developer CLI Usage

### Zero-Disk Secret Injection (`keyzen run`)
Run any application without storing sensitive `.env` files on disk:
```bash
./cli/index.mjs run --token <kzn_token> -- npm start
./cli/index.mjs run --token <kzn_token> -- node index.js
./cli/index.mjs run --token <kzn_token> -- python main.py
```

### Save Token Locally
```bash
./cli/index.mjs login <kzn_token>
./cli/index.mjs run -- npm start
```

### Fetch a Single Secret
```bash
./cli/index.mjs get STRIPE_SECRET_KEY
```
