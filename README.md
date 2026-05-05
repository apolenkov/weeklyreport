# CustomReport

Weekly status report automation for the CoreDev department. Six team leads fill in their sections via structured forms (project traffic lights, current/next week items, risks, decisions). The system assembles everything into a single report for the department head to review and publish.

## Architecture

```
customreport/
├── apps/
│   ├── web/          Next.js 16 frontend (App Router, React 19)
│   └── api/          NestJS 11 backend (tRPC, Prisma 7)
├── packages/
│   ├── shared/       Zod schemas, TypeScript types, tRPC router definition
│   └── ui/           shadcn/ui components, Tailwind CSS v4 design tokens
├── prisma/           Schema (14 models), migrations, seed data
└── docker-compose.yml  PostgreSQL 15 + Redis 7
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui v4 |
| Backend | NestJS 11, tRPC 11, Prisma 7 |
| Database | PostgreSQL 15, Redis 7 |
| Auth | SAML via Keycloak (production), dev-login (development) |
| Testing | Vitest 4, Playwright 1.59, @axe-core/playwright |
| Monorepo | Turborepo 2, pnpm 10 |

## Operating in production

- **[RUNBOOK.md](RUNBOOK.md)** — symptom → cause → fix for the top 10 failure modes
- **[INCIDENT-PLAYBOOK.md](INCIDENT-PLAYBOOK.md)** — rollback procedure, on-call rotation template, postmortem format
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — local setup, commit conventions, husky hooks, push-guard helper

## Quick Start

Prerequisites: **Node.js 20+**, **pnpm 10+**, **Docker Desktop**.

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template (root .env is the single source of truth — both apps read it)
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

# 3. Start infrastructure (postgres + redis + mailhog)
docker compose up -d postgres redis mailhog

# 4. Run migrations and seed (uses .env automatically)
pnpm exec prisma migrate deploy
pnpm exec prisma db seed

# 5. Start both dev servers (turbo --parallel)
pnpm dev
```

Open http://localhost:3000.

The web app runs in webpack mode by default — Next 16.2.3's Turbopack hits a runaway rebuild loop on this monorepo, so `apps/web/package.json`'s `dev` script pins `next dev --webpack` until the upstream regression is fixed.

### Sign in (dev mode)

`AUTH_DEV_MODE=true` enables `/auth/dev-login` — visit a URL below to set the JWT cookie and be redirected to the role's home page:

| Role | URL |
|------|-----|
| Head | `/auth/dev-login?role=head` |
| Lead — **Olga** (Week 16 draft) | `/auth/dev-login?role=lead&email=olga@customreport.local` |
| Lead — Polenkov (Week 16 submitted) | `/auth/dev-login?role=lead&email=polenkov@customreport.local` |
| Lead — Sergey (Week 16 draft) | `/auth/dev-login?role=lead&email=sergey@customreport.local` |
| Admin | `/auth/dev-login?role=admin` |
| Viewer | `/auth/dev-login?role=viewer` |

Without `&email=...` the `lead` role lands on a synthetic `lead1@customreport.local` user that has no projects or sections — pass an email of a seeded lead (Dmitry, Igor, Maria, **Olga**, Polenkov, Sergey) to actually see data.

### Dev-only tools

- **Role switcher** — `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` in `apps/web/.env.local` reveals a yellow "DEV: switch role" button at bottom-right of every authenticated page. Drops a dropdown to swap identity, wipe & reseed, or log out without retyping URLs.
- **MailHog** — outbound email goes to a local catch-all SMTP. UI at http://localhost:8025 shows every reminder/escalation rendered as HTML.

### Troubleshooting

| Symptom | Fix |
|---|---|
| Web binds to :3001, not :3000 | Something else holds :3000. Free it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`) and confirm `.env` has `FRONTEND_URL=http://localhost:3000`. |
| `next-server` eats >500% CPU and `.next/dev/trace` keeps growing | Next 16.2.3 Turbopack regression. Already mitigated via `--webpack` flag in `apps/web/package.json`; if it returns, kill `next dev`, `rm -rf apps/web/.next`, and restart. |
| `PDF_EXPORT_JWT_SECRET is missing or too short` on PDF export | The Zod schema in `apps/api/src/infrastructure/config/env.schema.ts` carries a dev default — confirm the new `apps/api/src/main.ts` line `process.env['PDF_EXPORT_JWT_SECRET'] ??= env.PDF_EXPORT_JWT_SECRET;` is present. Otherwise add to `.env`. |
| `prisma migrate reset` blocked by AI-safety guard | Re-run with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да` (Prisma 7 ai-fence). |
| `Cannot find module '@nestjs/schedule'` | Lockfile drift after partial install — run `pnpm install` from the repo root. |

## Pages

| Route | Role | Description |
|-------|------|-------------|
| `/lead/report` | lead | Report section form with traffic lights, items, risks, decisions, priorities |
| `/head/dashboard` | head | Review dashboard showing all lead submissions |
| `/head/report` | head | Assembled report with publish action |
| `/admin` | head | User, project, period, and reminder management |
| `/reports/history` | any | Published report archive |
| `/reports/[id]` | any | Single published report detail |
| `/reports/[id]/print` | any | Print-optimized report for PDF export |

## Data Model

14 Prisma models: User, Project, Report, ReportSection, ProjectStatus, Item, Risk, Decision, Priority, PdfExportJob, ReminderRule, ReminderExecution, CarryOverExecution, CarryOverRecord.

## API

tRPC routers via `/trpc` (proxied through Next.js rewrites):

- `reports.*` — getActive, saveDraft, submit
- `review.*` — getDashboard, getAssembledReport
- `publication.*` — publish
- `admin.*` — snapshot, saveUser, deleteUser, saveProject, deleteProject, savePeriod, deletePeriod, saveReminder, deleteReminder, runCarryOver
- `archive.*` — list, getById
- `pdfExport.*` — requestExport, getStatus

## Testing

```bash
# Unit tests (no servers needed)
pnpm -F @customreport/shared exec vitest run src/schemas/__tests__/   # 115 schema tests
pnpm -F @customreport/api test                                        # 68 service tests

# E2E tests (need Docker + servers on ports 3100/3101)
cd apps/web
DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport" \
  pnpm exec playwright test                                           # 85 E2E tests
```

### Test Coverage

| Category | Tests | What's covered |
|----------|-------|---------------|
| Schema boundary | 115 | Zod validation: safeText, UUID, dates, arrays, enums, ranks |
| API service | 68 | Business rules, error handling, state transitions, auth |
| E2E journeys | 26 | Lead report, head publication, admin CRUD, carry-over, archive |
| E2E visual | 8 | Screenshot regression for key pages |
| E2E accessibility | 8 | axe-core WCAG 2.1 AA audit, keyboard navigation |
| E2E responsive | 16 | 5 viewports (320-1920px) for lead and admin pages |
| **Total** | **268** | |

## Environment Variables

Single source of truth: root `.env` (loaded by api via `--env-file=../../.env`) and `apps/web/.env.local` (read by Next.js for `NEXT_PUBLIC_*`). See `.env.example` and `apps/web/.env.example` for the full list.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_HOST` | Yes | localhost | Redis host |
| `REDIS_PORT` | Yes | 6379 | Redis port |
| `AUTH_DEV_MODE` | No | false | Enable `/auth/dev-login` endpoint |
| `AUTH_JWT_SECRET` | Yes (prod) | — | Session JWT signing secret (min 32 chars) |
| `PDF_EXPORT_JWT_SECRET` | No | dev default | Short-lived JWT signed at PDF export entry, injected as cookie into the headless browser. Min 16 chars. |
| `FRONTEND_URL` | Yes | http://localhost:3000 | Web app URL (CORS allowlist + post-auth redirects) |
| `PORT` | No | 3002 | API server port |
| `LOG_LEVEL` | No | info | `debug`/`info`/`warn`/`error` (debug enables tRPC envelope shape breadcrumbs) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | No | — | When set, real SMTP send. With MailHog: `localhost:1025`. |
| `NEXT_PUBLIC_API_URL` | Yes (web) | http://localhost:3002 | tRPC client base URL |
| `NEXT_PUBLIC_DEV_ROLE_SWITCHER` | No | false | Show the bottom-right DEV identity dropdown |

## Local development with mock Keycloak

Phase 29-04 finalised the AUTH-01 cut-over: production reads SAML attributes
from a real Keycloak realm only. The boot fence in
`apps/api/src/lib/dev-auth-fence.ts` refuses to start the API if either
`AUTH_DEV_MODE` or `AUTH_DEV_MODE_ALLOW_TEST` is set under
`NODE_ENV=production`.

For local development and the Playwright integration suite, the dev path is
still available:

- `NODE_ENV=development AUTH_DEV_MODE=true` boots the legacy dev fallback
  (`DEV_SESSION` head user) — no Keycloak required.
- `NODE_ENV=test AUTH_DEV_MODE_ALLOW_TEST=true` is the narrower staged switch
  used by `apps/web/playwright.integration.config.ts` so the integration suite
  exercises real tRPC + Prisma without flipping production.

A mock Keycloak 26 container in `docker-compose.test.yml` loading
`infra/keycloak/realm-export.json` is the planned follow-up; the realm fixture
(4 fixture users, `saml-role-mapper`) is already in place from Phase 29-02. It
is deferred only because the Phase 29-04 worktree could not pull
`quay.io/keycloak/keycloak:26` (no Docker network from the build host). Once
the container is wired, Playwright's `e2e/integration/global-setup.ts` will
perform a real SAML AuthnRequest instead of the dev-login shortcut.

## Scripts

```bash
pnpm build          # Build all packages (Turborepo)
pnpm test           # Run all unit tests
pnpm lint           # TypeScript check + ESLint
pnpm -F <pkg> dev   # Dev server for specific package
```

## License

Private — internal use only.
