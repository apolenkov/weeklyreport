# CustomReport

Weekly status report automation for a software department. Six team leads fill in their sections via structured forms (project traffic lights, current/next week items, risks, decisions). The system assembles everything into a single report for the department head to review and publish.

## Architecture

```text
customreport/
├── apps/
│   ├── web/          Next.js 16 frontend (App Router, React 19)
│   └── api/          NestJS 11 backend (tRPC, Prisma 7)
├── packages/
│   ├── shared/       Zod schemas, TypeScript types, tRPC router definition
│   └── ui/           shadcn/ui components, Tailwind CSS v4 design tokens
├── prisma/           Schema (20 models), migrations, seed data
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
- **[docs/OPERATIONS.md](docs/OPERATIONS.md)** — dev/test/prod Docker commands, wipe/reseed, integration gates, Kubernetes porting map

## Quick Start

For a new engineer, the safest first run is the full Docker verifier. It
builds the app containers, starts infrastructure, wipes/reseeds the local
Docker database, proves health endpoints and authenticated tRPC, then leaves
the UI running for manual testing.

Prerequisites: **Node.js 20+**, **pnpm 10+**, **Docker Desktop**.

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template
cp .env.example .env

# 3. Build, start, wipe/reseed, and verify the full local Docker stack
pnpm docker:local:verify
```

Open:

| Surface       | URL                                |
| ------------- | ---------------------------------- |
| Web app       | http://localhost:3000              |
| API readiness | http://localhost:3002/health/ready |
| API metrics   | http://localhost:3002/metrics      |
| Mailpit       | http://localhost:8025              |

Evidence is written to
`.planning/regression/evidence/docker-compose-local/verify.log`.

**Preferred dev loop (docker compose watch, auto-restart on save):**

```bash
pnpm dev:watch
```

This wraps `docker compose -f docker-compose.yml -f docker-compose.dev.yml up
--watch` (requires Docker Compose v2.22+). On any change under `apps/api/src/`, `apps/web/src/`,
`packages/shared/src/`, or `prisma/schema.prisma`, the relevant container
restarts within ~3 seconds. Use this instead of host-mode `pnpm dev` to avoid
the stale-`node --watch` failure class (long-running container silently stops
reloading after 12–24 h uptime).

Host-mode development is still available for the fastest edit loop (no
container layer), at the cost of having to remember `docker compose restart
api web` after long uptimes:

```bash
# 1. Start infrastructure only
docker compose up -d postgres redis mailhog

# 2. Run migrations and seed
pnpm exec prisma migrate deploy
pnpm exec prisma db seed

# 3. Start both dev servers on the host
pnpm dev
```

Full-container local development without auto-restart (legacy, useful for
detached / long-running setups without watch overhead):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

The local API listens on http://localhost:3002; the web app proxies `/trpc`,
`/auth`, and `/health` to that API through Next.js rewrites.

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
- **Manual UAT wipe** — the role switcher action `Wipe reports (manual UAT)` deletes report history/content/PDF jobs/reminder executions/carry-over/AI insights,
  SDLC stage assignments, and local Redis queue state; keeps users/roles/products/stages/app settings; and creates one empty open report with lead sections.
  Products appear in a lead report only after SDLC stage assignments are configured.
  Terminal: `pnpm db:wipe:manual-uat`; inside Docker:
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api pnpm --dir apps/api exec tsx ../../prisma/wipe-manual-uat.ts`.
- **Mailpit** — outbound email goes to a local catch-all SMTP. UI at http://localhost:8025 shows every reminder/escalation rendered as HTML. The Compose service is still named `mailhog` for backward-compatible env wiring.
- **Observability** — `pnpm observability:up` starts Prometheus (http://localhost:9090), Grafana (http://localhost:3003, `admin`/`admin`), Postgres exporter, and Redis exporter against the running local stack.

## Verification And Evidence

Use this order when deciding whether the product is ready for manual UAT or
a merge:

```text
[Unit/type gates] --> [Docker verifier] --> [Role regression] --> [Logs/screenshots]
```

```bash
# Fast code gates
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# API integration gate against .env.test customreport_test
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T postgres \
  sh -lc 'createdb -U customreport customreport_test 2>/dev/null || true'
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_test \
  pnpm exec prisma migrate deploy --schema=prisma/schema.prisma
pnpm --filter @customreport/api test:integration

# Full local container gate; destructive for the local Docker DB
pnpm docker:local:verify

# Progressive role lifecycle against the running :3000/:3002 stack
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  e2e/regression/product-ready-progressive.spec.ts

# Full regression suite against the running stack
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
```

Regression evidence locations:

| Evidence                       | Path                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| Docker verifier log            | `.planning/regression/evidence/docker-compose-local/verify.log` |
| Product-ready screenshots/logs | `.planning/regression/evidence/product-ready-progressive/`      |
| Dashboard smoke evidence       | `.planning/regression/evidence/dashboard-post-publish-smoke/`   |
| Playwright traces/results      | `.planning/regression/agent-c-test-results/`                    |

Operational log checks:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=200 api
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --since=10m api web
pnpm logs:errors
```

PDF export sanity check inside the API container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api \
  sh -c "cd apps/api && node --input-type=module -e \"import { chromium } from 'playwright'; const b = await chromium.launch({ headless: true }); await b.close(); console.log('playwright ok')\""
```

Observability sanity check:

```bash
pnpm observability:up
curl http://localhost:3002/metrics | grep http_request_duration_seconds
open http://localhost:3003
```

### Troubleshooting

| Symptom                                                          | Fix                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web cannot reach API                                             | Confirm the API is listening on :3002 (`curl http://localhost:3002/health/ready`) and `apps/web/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3002`.                                                                                        |
| `next-server` eats >500% CPU and `.next/dev/trace` keeps growing | Next 16.2.3 Turbopack regression. Already mitigated via `--webpack` flag in `apps/web/package.json`; if it returns, kill `next dev`, `rm -rf apps/web/.next`, and restart.                                                                          |
| `PDF_EXPORT_JWT_SECRET is missing or too short` on PDF export    | The Zod schema in `apps/api/src/infrastructure/config/env.schema.ts` carries a dev default — confirm the new `apps/api/src/main.ts` line `process.env['PDF_EXPORT_JWT_SECRET'] ??= env.PDF_EXPORT_JWT_SECRET;` is present. Otherwise add to `.env`. |
| `pdf-export` failed jobs mention a missing Playwright browser    | Rebuild/recreate the API container: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build api`. Then run the PDF sanity check above and retry failed jobs from `/admin?tab=jobs`.                                           |
| Dashboard stays on skeleton after a report was published         | Check `weeklyReport.get` in API logs. The endpoint should fall back to the latest published period when no `open/reopened` period exists; this is covered by `weekly-report.prisma-repository.test.ts`.                                             |
| Head/admin opening `/lead/report/<id>` logs `leadForm.byPeriod`  | This should redirect to `/head/report/<id>` unless `authorId` is present. If it logs a 5xx, check `LeadForm` role redirect and `LeadFormDomainError` mapping.                                                                                       |
| `prisma migrate reset` blocked by AI-safety guard                | Re-run with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=да` (Prisma 7 ai-fence).                                                                                                                                                                   |
| `Cannot find module '@nestjs/schedule'`                          | Lockfile drift after partial install — run `pnpm install` from the repo root.                                                                                                                                                                       |

## Pages

| Route                    | Role       | Description                                                                  |
| ------------------------ | ---------- | ---------------------------------------------------------------------------- |
| `/lead/report`           | lead       | Report section form with traffic lights, items, risks, decisions, priorities |
| `/head/dashboard`        | head       | Review dashboard showing all lead submissions                                |
| `/head/report`           | head       | Assembled report with publish action                                         |
| `/admin`                 | head       | User, project, period, and reminder management                               |
| `/reports?tab=published` | any        | Published report archive                                                     |
| `/reports/[id]`          | any        | Single published report detail                                               |
| `/print/[id]`            | PDF worker | Print-optimized report for PDF export                                        |

## Data Model

20 Prisma models: User, Project, Report, ReportSection, ProjectStatus, Item,
Risk, Decision, Priority, PdfExportJob, ReminderRule, ReminderExecution,
CarryOverExecution, CarryOverRecord, VersionSnapshot, Stage,
StageAssignment, ReopenRequest, AppSettings, AiInsight.

## API

tRPC routers via `/trpc` (proxied through Next.js rewrites):

- `reports.*` — getActive, saveDraft, submit
- `review.*` — getDashboard, getAssembledReport
- `publication.*` — publish
- `admin.*` — snapshot, saveUser, deleteUser, saveProject, deleteProject, savePeriod, deletePeriod, saveReminder, deleteReminder, runCarryOver
- `archive.*` — list, getById
- `pdfExport.*` — requestExport, getStatus

## Testing

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for the full dev/test/prod runbook,
including wipe/reseed, regression, log capture, screenshot evidence, and the
Kubernetes migration mapping.

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

| Variable                                | Required   | Default                                                       | Description                                                                                                        |
| --------------------------------------- | ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                          | Yes        | —                                                             | PostgreSQL connection string; non-prod DB names must be suffixed `_uat`, `_dev`, or `_test` for destructive guards |
| `REDIS_HOST`                            | Yes        | localhost                                                     | Redis host                                                                                                         |
| `REDIS_PORT`                            | Yes        | 6379                                                          | Redis port                                                                                                         |
| `AUTH_DEV_MODE`                         | No         | false                                                         | Enable `/auth/dev-login` endpoint                                                                                  |
| `AUTH_JWT_SECRET`                       | Yes (prod) | —                                                             | Session JWT signing secret (min 32 chars)                                                                          |
| `PDF_EXPORT_JWT_SECRET`                 | No         | dev default                                                   | Short-lived JWT signed at PDF export entry, injected as cookie into the headless browser. Min 16 chars.            |
| `FRONTEND_URL`                          | Yes        | http://localhost:3000                                         | Web app URL (CORS allowlist + post-auth redirects)                                                                 |
| `PORT`                                  | No         | 3002 in local `.env.example`; 3001 if unset by the API schema | API server port                                                                                                    |
| `LOG_LEVEL`                             | No         | info                                                          | `debug`/`info`/`warn`/`error` (debug enables tRPC envelope shape breadcrumbs)                                      |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | No         | —                                                             | When set, real SMTP send. With MailHog: `localhost:1025`.                                                          |
| `NEXT_PUBLIC_API_URL`                   | Yes (web)  | http://localhost:3002                                         | tRPC client base URL                                                                                               |
| `API_URL`                               | No         | —                                                             | Server-side API URL for Next.js SSR/session calls. In Docker use `http://api:3002` for dev.                        |
| `NEXT_PUBLIC_AUTH_STUB`                 | No         | false                                                         | Show the local dev-login picker on the landing page.                                                               |
| `NEXT_PUBLIC_DEV_ROLE_SWITCHER`         | No         | false                                                         | Show the bottom-right DEV identity dropdown                                                                        |

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
