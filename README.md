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

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 10+, Docker

# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose up postgres redis -d

# 3. Run migrations and seed
DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport" \
  npx prisma migrate deploy --schema prisma/schema.prisma
DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport" \
  node --experimental-strip-types prisma/seed.ts

# 4. Start development servers
# Terminal 1 — API (port 3001)
DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport" \
AUTH_DEV_MODE=true AUTH_JWT_SECRET="local-dev-secret-minimum-32-characters-long!!" \
REDIS_HOST=localhost REDIS_PORT=6379 FRONTEND_URL=http://localhost:3000 PORT=3001 \
pnpm -F @customreport/api dev

# Terminal 2 — Web (port 3000)
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm -F @customreport/web dev

# 5. Open http://localhost:3000
```

In dev mode (`AUTH_DEV_MODE=true`) no login is needed — you are automatically authenticated as **head** user. To switch roles, navigate to:

| Role | URL | What you see |
|------|-----|-------------|
| Lead | `/auth/dev-login?role=lead` | My Report form (fill and submit) |
| Head | `/auth/dev-login?role=head` | Dashboard, Assembled Report, Admin Panel |
| Viewer | `/auth/dev-login?role=viewer` | Report History (read-only) |

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

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_HOST` | Yes | localhost | Redis host |
| `REDIS_PORT` | Yes | 6379 | Redis port |
| `AUTH_DEV_MODE` | No | false | Enable dev-login endpoint |
| `AUTH_JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `AUTH_JWT_COOKIE_NAME` | No | customreport_session | Cookie name |
| `FRONTEND_URL` | Yes | — | Web app URL (for CORS and redirects) |
| `PORT` | No | 3001 | API server port |
| `NEXT_PUBLIC_API_URL` | Yes | — | API URL for tRPC client (used by Next.js rewrites) |

## Scripts

```bash
pnpm build          # Build all packages (Turborepo)
pnpm test           # Run all unit tests
pnpm lint           # TypeScript check + ESLint
pnpm -F <pkg> dev   # Dev server for specific package
```

## License

Private — internal use only.
