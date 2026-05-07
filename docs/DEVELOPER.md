# Developer Onboarding Guide

CustomReport is a weekly status reporting system for a software department.
Leads fill structured forms, the system compiles an assembled report, and the
Head publishes it. This guide gets you from zero to a running local environment.
For the full operator command matrix (dev/test/prod, Docker verification,
wipe/reseed, and Kubernetes porting), see [OPERATIONS.md](OPERATIONS.md).

---

## 1. Quick Start

**Prerequisites:** Node.js >= 20.19, pnpm 10.x, Docker + Docker Compose.

```bash
# 1. Clone the repository
git clone <repo-url> customreport
cd customreport

# 2. Install dependencies
pnpm install

# 3. Copy environment config
cp .env.example .env
# Edit .env if needed — defaults work for local development

# 4. Start PostgreSQL and Redis
docker compose up -d postgres redis

# 5. Run database migrations
pnpm exec prisma migrate dev

# 6. Seed the database with test data
pnpm exec prisma db seed

# 7. Generate Prisma Client (if not already generated)
pnpm exec prisma generate

# 8. Build shared packages (required before first dev run)
pnpm run build --filter=@customreport/shared --filter=@customreport/ui

# 9. Start all dev servers (Next.js + NestJS in parallel)
pnpm run dev
```

After startup:

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:3000 |
| API      | http://localhost:3002 |

The dev login page shows role-selector buttons (Lead, Head, Viewer) — no
Keycloak setup required when `AUTH_DEV_MODE=true`.

### Docker-based development (alternative)

If you prefer running everything in Docker, including the app servers:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This starts PostgreSQL, Redis, API (port 3002), and Web (port 3000) in
containers with hot-reload volume mounts.

---

## 2. Monorepo Structure

```
customreport/
  apps/
    api/             # NestJS backend (tRPC, Prisma, BullMQ)
    web/             # Next.js 16 frontend (React 19, shadcn/ui)
  packages/
    shared/          # Zod schemas, tRPC router types, shared utilities
    ui/              # shadcn/ui components, design tokens, global styles
  prisma/
    schema.prisma    # Database schema (PostgreSQL)
    seed.ts          # Development seed data
    migrations/      # Prisma migration history
  mockups/           # HTML mockup + PNG screenshots
  docs/              # API contracts, role matrix, this guide
  .planning/         # GSD workflow artifacts
```

### Workspace packages

| Package                | Path              | Purpose                                     |
| ---------------------- | ----------------- | ------------------------------------------- |
| `@customreport/web`    | `apps/web`        | Next.js frontend, pages, components, styles |
| `@customreport/api`    | `apps/api`        | NestJS API, tRPC routers, domain modules    |
| `@customreport/shared` | `packages/shared` | Zod schemas, tRPC type exports, validators  |
| `@customreport/ui`     | `packages/ui`     | shadcn/ui components, Tailwind tokens       |

Cross-package imports use workspace aliases:

```typescript
import { reportSchema } from "@customreport/shared";
import { Button } from "@customreport/ui";
```

---

## 3. Development Workflow

### Turborepo tasks

All tasks are orchestrated via Turborepo. Run from the monorepo root:

```bash
pnpm run dev          # Start all dev servers (parallel, persistent)
pnpm run build        # Build all packages in dependency order
pnpm run lint         # Lint all packages (TypeScript + ESLint)
pnpm run typecheck    # Type-check all packages
pnpm run test         # Run unit tests in all packages
```

### Filtering by package

```bash
# Run only the web dev server
pnpm run dev --filter=@customreport/web

# Type-check only the API
pnpm run typecheck --filter=@customreport/api

# Run tests for shared package
pnpm run test --filter=@customreport/shared
```

### Hot reload

- **Frontend:** Next.js with Turbopack (default in v16) — sub-200ms HMR.
- **API:** Node.js `--watch` flag on `src/main.ts` — auto-restarts on file
  changes. Uses `@swc-node/register` for TypeScript execution without a build
  step.

### TypeScript configuration

The project uses TypeScript 5.9 in strict mode. Base config is in
`tsconfig.base.json`:

- Target: ES2022
- Module: ESNext with Bundler resolution
- Strict mode enabled (all strict checks)
- `verbatimModuleSyntax: true` — type imports must use `import type`
- Path aliases map `@customreport/shared` and `@customreport/ui` to source

Each app extends the base config with its own `tsconfig.json`.

---

## 4. Database

### Prisma schema

The schema lives at `prisma/schema.prisma` and defines 16 models:

- **Core:** User, Project, Report, ReportSection
- **Content:** ProjectStatus, Item, Risk, Decision, Priority
- **Features:** PdfExportJob, ReminderRule, ReminderExecution,
  CarryOverExecution, CarryOverRecord, VersionSnapshot
- **Config:** Stage, StageAssignment, AppSettings

Three roles: `lead`, `head`, `viewer`. Report lifecycle:
`draft` -> `published`. Period lifecycle: `open` -> `published` -> `reopened`.

### Running migrations

```bash
# Apply pending migrations (development — creates migration if schema changed)
pnpm exec prisma migrate dev

# Apply migrations without creating new ones (CI / staging)
pnpm exec prisma migrate deploy

# Create a migration without applying it (for manual SQL edits)
pnpm exec prisma migrate dev --create-only
```

### Seeding

```bash
pnpm exec prisma db seed
```

This creates: 6 leads, 1 head, 1 viewer, 6 projects, 2 report periods,
7 SDLC stages, stage assignments, and app settings. The seed script is at
`prisma/seed.ts` and uses `@prisma/adapter-pg` with a raw `pg.Pool`.

### Prisma Studio

```bash
pnpm exec prisma studio
```

Opens a browser-based database explorer at http://localhost:5555.

### Prisma configuration

Prisma 7 uses `prisma.config.ts` at the repo root for configuration. The
`datasource.url` reads from the `DATABASE_URL` environment variable.

---

## 5. Testing

### Unit & contract tests (Vitest)

```bash
# Run all unit tests
pnpm run test

# Run tests for a specific package
pnpm run test --filter=@customreport/api

# Run in watch mode (single package)
cd apps/api && pnpm exec vitest

# Run specific test file
cd apps/api && pnpm exec vitest run src/modules/auth/auth.service.test.ts
```

The API excludes integration tests by default (`--exclude '**/*.integration.test.ts'`).

### Integration tests

```bash
# Requires running PostgreSQL and Redis
cd apps/api && pnpm run test:integration
```

Integration tests run against a real database with `--fileParallelism=false`
to avoid race conditions.

### E2E tests (Playwright)

```bash
# Run E2E tests (requires running dev servers)
pnpm run test:e2e

# Run with Playwright UI
pnpm run test:e2e:ui
```

Playwright config is at `apps/web/playwright.config.ts`. Tests live in
`apps/web/e2e/`. The web dev server starts on port 3100 for E2E by default
(configurable via `E2E_WEB_PORT`).

---

## 6. Adding a New Feature

Follow this sequence when adding a feature end-to-end:

### Step 1: Define schemas (packages/shared)

Add Zod schemas in `packages/shared/src/schemas/`:

```typescript
// packages/shared/src/schemas/my-feature.ts
import { z } from "zod";

export const myFeatureInput = z.object({
  name: z.string().min(1),
  value: z.number().positive(),
});

export type MyFeatureInput = z.infer<typeof myFeatureInput>;
```

Export from `packages/shared/src/index.ts`.

### Step 2: Add API module (apps/api)

Create a module directory under `apps/api/src/modules/`:

```
apps/api/src/modules/my-feature/
  my-feature.service.ts      # Business logic
  my-feature.router.ts       # tRPC router
  my-feature.service.test.ts # Unit tests
```

The tRPC router uses procedures (`protectedProcedure` or `headProcedure`)
from `src/infrastructure/trpc/`.

### Step 3: Register the router

Add the new router to the app router in
`apps/api/src/infrastructure/trpc/trpc.router.ts`.

### Step 4: Build UI components (apps/web)

- Page route: `apps/web/src/app/(app)/my-feature/page.tsx`
- Components: `apps/web/src/components/my-feature/`
- Use tRPC React Query hooks to call the API

### Step 5: Update Prisma schema (if needed)

```bash
# Edit prisma/schema.prisma, then:
pnpm exec prisma migrate dev --name add_my_feature_table
pnpm exec prisma generate
```

---

## 7. Code Quality

### ESLint

The project uses ESLint 10 with flat config (`eslint.config.ts`):

- `@typescript-eslint/strict` ruleset
- `react-hooks` rules (rules-of-hooks, exhaustive-deps)
- `react-compiler` rule (enforces React Compiler compatibility)
- `no-floating-promises: error` — all promises must be handled
- `no-explicit-any: error` — no `any` type allowed

```bash
pnpm run lint
```

### Prettier

Code formatting is handled by Prettier. Check formatting:

```bash
pnpm exec prettier --check .
```

### Pre-commit hooks (Husky)

Husky runs lint-staged on pre-commit, formatting and linting only staged files.
This runs automatically — no manual setup after `pnpm install`.

---

## 8. Troubleshooting

### Port conflicts

| Port | Service    | Fix                                         |
| ---- | ---------- | ------------------------------------------- |
| 3000 | Next.js    | Kill existing process or set `PORT` in .env |
| 3002 | NestJS API | Set `PORT` in .env                          |
| 5432 | PostgreSQL | Stop local PostgreSQL or change docker port |
| 6379 | Redis      | Stop local Redis or change docker port      |

### Prisma migration drift

If Prisma warns about drift between schema and database:

```bash
# Reset database (WARNING: destroys all data)
pnpm exec prisma migrate reset

# Or manually resolve
pnpm exec prisma migrate dev
```

### "Cannot find module @customreport/shared"

Shared packages must be built before the first dev run:

```bash
pnpm run build --filter=@customreport/shared --filter=@customreport/ui
```

### Auth errors in dev mode

Ensure `.env` has `AUTH_DEV_MODE=true`. The dev login bypass only works when
this flag is set. Without it, the app expects a running Keycloak instance.

### Docker containers not starting

```bash
# Check container status
docker compose ps

# View logs for a specific service
docker compose logs postgres
docker compose logs redis

# Restart everything
docker compose down && docker compose up -d postgres redis
```

### Database connection refused

Ensure PostgreSQL is running and `DATABASE_URL` in `.env` matches the Docker
Compose credentials:

```
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport
```

The default password for Docker Compose is `localdev` (set via `DB_PASSWORD`
env variable).
