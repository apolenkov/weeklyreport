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

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui v4     |
| Backend  | NestJS 11, tRPC 11, Prisma 7                            |
| Database | PostgreSQL 15, Redis 7                                  |
| Auth     | SAML via Keycloak (production), dev-login (development) |
| Testing  | Vitest 4, Playwright 1.59, @axe-core/playwright         |
| Monorepo | Turborepo 2, pnpm 10                                    |

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

# 3. Start infrastructure (postgres + redis + mailpit)
docker compose up -d postgres redis mailhog

# 4. Run migrations and seed (uses .env automatically)
pnpm exec prisma migrate deploy
pnpm exec prisma db seed

# 5. Start both dev servers (turbo --parallel)
pnpm dev
```

Full-container local verification (web + api + infrastructure in Docker):

```bash
pnpm docker:local:verify
```

This command runs `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`,
wipes/reseeds the database inside the API container, then verifies web, API,
Mailpit, dev-login, and authenticated tRPC through the containerized web app.
Evidence is written to `.planning/regression/evidence/docker-compose-local/`.

Open http://localhost:3000. The local API listens on
http://localhost:3002; the web app proxies `/trpc`, `/auth`, and `/health`
to that API through Next.js rewrites.

### Sign in (dev mode)

`AUTH_DEV_MODE=true` enables `/auth/dev-login` — visit a URL below to set the JWT cookie and be redirected to the role's home page:

| Role                         | URL                                                         |
| ---------------------------- | ----------------------------------------------------------- |
| Head                         | `/auth/dev-login?role=head`                                 |
| Lead — Lead 1 (active draft) | `/auth/dev-login?role=lead&email=lead1@customreport.local`  |
| Lead — Maria (submitted)     | `/auth/dev-login?role=lead&email=maria@customreport.local`  |
| Lead — Igor (active draft)   | `/auth/dev-login?role=lead&email=igor@customreport.local`   |
| Lead — Dmitry (submitted)    | `/auth/dev-login?role=lead&email=dmitry@customreport.local` |
| Lead — Olga (active draft)   | `/auth/dev-login?role=lead&email=olga@customreport.local`   |
| Lead — Sergey (active draft) | `/auth/dev-login?role=lead&email=sergey@customreport.local` |
| Admin                        | `/auth/dev-login?role=admin`                                |
| Viewer                       | `/auth/dev-login?role=viewer`                               |

Without `&email=...` the `lead` role uses the primary seeded lead,
`lead1@customreport.local`.

### Dev-only tools

- **Role switcher** — `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` in `apps/web/.env.local` reveals a yellow "DEV: switch role" button at bottom-right of every authenticated page. Drops a dropdown to swap identity, wipe & reseed, or log out without retyping URLs.
- **Mailpit** — outbound email goes to a local catch-all SMTP. UI at http://localhost:8025 shows every reminder/escalation rendered as HTML. The Compose service is still named `mailhog` for backward-compatible env wiring.

### Troubleshooting

| Symptom                                                          | Fix                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web cannot reach API                                             | Confirm the API is listening on :3002 (`curl http://localhost:3002/health/ready`) and `apps/web/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3002`.                                                                                        |
| `next-server` eats >500% CPU and `.next/dev/trace` keeps growing | Next 16.2.3 Turbopack regression. Already mitigated via `--webpack` flag in `apps/web/package.json`; if it returns, kill `next dev`, `rm -rf apps/web/.next`, and restart.                                                                          |
| `PDF_EXPORT_JWT_SECRET is missing or too short` on PDF export    | The Zod schema in `apps/api/src/infrastructure/config/env.schema.ts` carries a dev default — confirm the new `apps/api/src/main.ts` line `process.env['PDF_EXPORT_JWT_SECRET'] ??= env.PDF_EXPORT_JWT_SECRET;` is present. Otherwise add to `.env`. |
| `prisma migrate reset` blocked by AI-safety guard                | Re-run with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да` (Prisma 7 ai-fence).                                                                                                                                                                   |
| `Cannot find module '@nestjs/schedule'`                          | Lockfile drift after partial install — run `pnpm install` from the repo root.                                                                                                                                                                       |

## Pages

| Route                 | Role | Description                                                                  |
| --------------------- | ---- | ---------------------------------------------------------------------------- |
| `/lead/report`        | lead | Report section form with traffic lights, items, risks, decisions, priorities |
| `/head/dashboard`     | head | Review dashboard showing all lead submissions                                |
| `/head/report`        | head | Assembled report with publish action                                         |
| `/admin`              | head | User, project, period, and reminder management                               |
| `/reports/history`    | any  | Published report archive                                                     |
| `/reports/[id]`       | any  | Single published report detail                                               |
| `/reports/[id]/print` | any  | Print-optimized report for PDF export                                        |

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

| Category          | Tests   | What's covered                                                 |
| ----------------- | ------- | -------------------------------------------------------------- |
| Schema boundary   | 115     | Zod validation: safeText, UUID, dates, arrays, enums, ranks    |
| API service       | 68      | Business rules, error handling, state transitions, auth        |
| E2E journeys      | 26      | Lead report, head publication, admin CRUD, carry-over, archive |
| E2E visual        | 8       | Screenshot regression for key pages                            |
| E2E accessibility | 8       | axe-core WCAG 2.1 AA audit, keyboard navigation                |
| E2E responsive    | 16      | 5 viewports (320-1920px) for lead and admin pages              |
| **Total**         | **268** |                                                                |

## Environment Variables

Single source of truth: root `.env` (loaded by api via `--env-file=../../.env`) and `apps/web/.env.local` (read by Next.js for `NEXT_PUBLIC_*`). See `.env.example` and `apps/web/.env.example` for the full list.

| Variable                                | Required   | Default                                                       | Description                                                                                             |
| --------------------------------------- | ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Yes        | —                                                             | PostgreSQL connection string                                                                            |
| `REDIS_HOST`                            | Yes        | localhost                                                     | Redis host                                                                                              |
| `REDIS_PORT`                            | Yes        | 6379                                                          | Redis port                                                                                              |
| `AUTH_DEV_MODE`                         | No         | false                                                         | Enable `/auth/dev-login` endpoint                                                                       |
| `AUTH_JWT_SECRET`                       | Yes (prod) | —                                                             | Session JWT signing secret (min 32 chars)                                                               |
| `PDF_EXPORT_JWT_SECRET`                 | No         | dev default                                                   | Short-lived JWT signed at PDF export entry, injected as cookie into the headless browser. Min 16 chars. |
| `FRONTEND_URL`                          | Yes        | http://localhost:3000                                         | Web app URL (CORS allowlist + post-auth redirects)                                                      |
| `PORT`                                  | No         | 3002 in local `.env.example`; 3001 if unset by the API schema | API server port                                                                                         |
| `LOG_LEVEL`                             | No         | info                                                          | `debug`/`info`/`warn`/`error` (debug enables tRPC envelope shape breadcrumbs)                           |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | No         | —                                                             | When set, real SMTP send. With MailHog: `localhost:1025`.                                               |
| `NEXT_PUBLIC_API_URL`                   | Yes (web)  | http://localhost:3002                                         | tRPC client base URL                                                                                    |
| `API_URL`                               | No         | —                                                             | Server-side API URL for Next.js SSR/session calls. In Docker use `http://api:3002` for dev.             |
| `NEXT_PUBLIC_AUTH_STUB`                 | No         | false                                                         | Show the local dev-login picker on the landing page.                                                    |
| `NEXT_PUBLIC_DEV_ROLE_SWITCHER`         | No         | false                                                         | Show the bottom-right DEV identity dropdown                                                             |

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

The mock Keycloak container remains a deferred follow-up. There is currently
no `docker-compose.test.yml` in the repository; the committed integration
suite still uses the dev-login test switch rather than a real SAML
AuthnRequest.

## Scripts

```bash
pnpm build          # Build all packages (Turborepo)
pnpm test           # Run all unit tests
pnpm lint           # TypeScript check + ESLint
pnpm -F <pkg> dev   # Dev server for specific package
```

## License

Private — internal use only.
