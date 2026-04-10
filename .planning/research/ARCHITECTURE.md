# Architecture Patterns: Infrastructure Integration

**Domain:** Weekly status report system (NestJS + Next.js monorepo)
**Researched:** 2026-04-10
**Focus:** How infrastructure features integrate with existing domain-logic codebase

## Current Architecture Snapshot

The v1 codebase is a clean domain-logic prototype with no runtime infrastructure.

```text
  Current State (v1)
  ==================

  apps/web (Next.js 15)
  ├── All pages are 'use client'
  ├── Data flows through localStorage (section-storage.ts)
  ├── Session from hardcoded dev-session.ts OR localStorage
  ├── useBrowserState() hook defers reads past hydration
  ├── middleware.ts checks cookie, bypassed in dev mode
  └── No tRPC client, no API calls

  apps/api (NestJS 11)
  ├── main.ts: empty bootstrap (creates logger, nothing else)
  ├── 8 domain services with repository INTERFACES (not implementations)
  │   ├── ReportSectionsService + ReportSectionsRepository
  │   ├── ReviewService + ReviewRepository
  │   ├── PublicationService + PublicationRepository
  │   ├── PdfExportService + PdfExportRepository
  │   ├── AdminService + AdminRepository
  │   ├── RemindersService + RemindersRepository
  │   ├── CarryOverService + CarryOverRepository
  │   └── ArchiveService + ArchiveRepository
  ├── 8 "router" files (plain objects, NOT tRPC routers)
  ├── Auth module: SAML strategy, JWT signer, role guards (factory functions)
  ├── Custom AppLogger (JSON structured, file rotation)
  └── No NestJS modules, no DI container, no HTTP server

  packages/shared
  ├── Zod schemas (report.ts, auth.ts) -- single source of truth
  ├── tRPC "contract" router (4 procedures, throw 'Not implemented')
  └── All type exports derived from Zod infer

  prisma/
  ├── schema.prisma: 10 models defined, NOT migrated
  ├── seed.ts: comprehensive seed data (head + 6 leads + projects)
  └── prisma.config.ts: env-based DATABASE_URL
```

### Key Architectural Properties

1. **Repository pattern already in place** -- every service accepts a repository interface via constructor injection. This is the seam where Prisma implementations plug in.
2. **Router files are NOT tRPC routers** -- they are plain async functions that take context objects. They need to be bridged into actual tRPC procedures.
3. **Auth is factory-function based** -- `createSamlStrategy()`, `createJwtSigner()`, `createRoleGuard()` are pure functions, not NestJS providers. They need wrapping to fit NestJS DI.
4. **Frontend is 100% client-side** -- all pages use `'use client'`, all data comes from localStorage. The migration to tRPC is a full rewrite of data flow, not an incremental change.

## Target Architecture (v2)

```text
  Target State (v2)
  =================

  Docker Compose Network
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
  │  │ web:3000 │───>│ api:3001 │───>│ postgres │              │
  │  │ Next.js  │    │ NestJS   │    │ :5432    │              │
  │  │          │    │ + tRPC   │    └──────────┘              │
  │  └──────────┘    │ + BullMQ │                              │
  │                  │ + SAML   │    ┌──────────┐              │
  │                  │          │───>│ redis    │              │
  │                  └──────────┘    │ :6379    │              │
  │                       │          └──────────┘              │
  │                       │                                    │
  │                  ┌──────────┐                              │
  │                  │ worker   │ (optional: separate process) │
  │                  │ BullMQ   │                              │
  │                  │ PDF+Email│                              │
  │                  └──────────┘                              │
  │                                                            │
  └─────────────────────────────────────────────────────────────┘
```

## Integration Point 1: NestJS Bootstrap + tRPC Adapter

### Current State

`main.ts` creates a logger and returns. No NestJS app, no HTTP listener, no modules.

### Target Flow

```text
  main.ts
    │
    ├── NestFactory.create(AppModule)
    │     │
    │     ├── AppModule
    │     │   ├── imports: [AuthModule, PrismaModule, BullModule, HealthModule]
    │     │   └── providers: [all domain services + repositories]
    │     │
    │     ├── app.use(helmet())
    │     ├── app.use(cookieParser())
    │     ├── app.enableCors({ origin: 'http://localhost:3000' })
    │     │
    │     └── TrpcAdapter (NestJS controller OR middleware)
    │           │
    │           ├── POST /trpc/:procedure  (mutations)
    │           ├── GET  /trpc/:procedure  (queries)
    │           │
    │           └── context factory:
    │                 request --> extract JWT from cookie
    │                         --> validate with JwtSigner
    │                         --> return { session, services... }
    │
    ├── Auth endpoints (outside tRPC):
    │     ├── GET  /auth/saml/login     (redirect to Keycloak)
    │     ├── POST /auth/saml/callback  (process SAML assertion)
    │     └── POST /auth/logout         (clear cookie)
    │
    └── app.listen(3001)
```

### Integration Pattern: tRPC + NestJS

The existing "router" files (plain objects with async methods) must be bridged into tRPC procedures. Two approaches exist:

**Approach A: tRPC standalone handler mounted as NestJS middleware (RECOMMENDED)**

The tRPC handler runs as Express middleware inside NestJS. The context factory gets NestJS-injected services and validates the JWT from the request cookie. This avoids the immature `@trpc/nestjs-adapter` package and uses tRPC's well-documented standalone adapter.

The tRPC router definition maps 1:1 from existing service methods:

```text
  appRouter = t.router({
    getActiveSection    --> reportSectionsService.getActiveSection()
    saveDraft           --> reportSectionsService.saveDraft()
    submitSection       --> reportSectionsService.submitSection()
    getSubmissionDashboard --> reviewService.getSubmissionDashboard()
    getAssembledReport  --> publicationService.getAssembledReport()
    publishReport       --> publicationService.publishReport()
    requestPdfExport    --> pdfExportService.requestPdfExport()
    getPdfExportStatus  --> pdfExportService.getPdfExportStatus()
    getAdminSnapshot    --> adminService.getSnapshot()
    upsertUser          --> adminService.upsertUser()
    upsertProject       --> adminService.upsertProject()
    upsertPeriod        --> adminService.upsertPeriod()
    listArchiveReports  --> archiveService.listArchiveReports()
    getArchiveReport    --> archiveService.getArchiveReport()
    executeCarryOver    --> carryOverService.executeCarryOver()
    requestReminder     --> remindersService.requestReminderExecution()
  })
```

**Why not full NestJS controllers wrapping each procedure:** The existing router files already define the procedure signatures. Wrapping each one in a NestJS controller + DTO class would duplicate validation (Zod + class-validator) and lose tRPC's type inference on the client side.

### New Files

| File | Purpose | Modifies existing? |
|------|---------|-------------------|
| `apps/api/src/app.module.ts` | Root NestJS module | NEW |
| `apps/api/src/trpc/trpc.router.ts` | Unified tRPC router | NEW (replaces shared contract) |
| `apps/api/src/trpc/trpc.context.ts` | Context factory | NEW |
| `apps/api/src/trpc/trpc.module.ts` | NestJS middleware mount | NEW |
| `apps/api/src/main.ts` | Full NestJS bootstrap | MODIFY (rewrite) |

### Modified Files

| File | Change |
|------|--------|
| `packages/shared/src/trpc/router.ts` | Delete contract stubs, re-export `AppRouter` type from api |
| `apps/api/src/modules/*/router.ts` | Delete (logic moves into tRPC procedures) |

## Integration Point 2: Prisma Repository Implementations

### Current State

Each service defines a repository interface (e.g., `ReportSectionsRepository`) and accepts it via constructor. No implementations exist.

### Integration Pattern: NestJS Providers

```text
  NestJS DI Container
  │
  ├── PrismaModule (global)
  │   └── provides: PrismaService (extends PrismaClient, onModuleInit connects)
  │
  ├── ReportSectionsModule
  │   ├── provides: PrismaReportSectionsRepository (implements ReportSectionsRepository)
  │   │              └── injects PrismaService
  │   └── provides: ReportSectionsService
  │                  └── injects PrismaReportSectionsRepository
  │
  ├── ReviewModule
  │   ├── provides: PrismaReviewRepository
  │   └── provides: ReviewService
  │
  └── ... (8 modules total, one per domain service)
```

Each repository implementation translates between Prisma models and the Zod-validated domain types. The mapping functions live inside the repository file (not exported) because the domain shape (e.g., `ReportSectionReadModel` with nested projects/items) differs from the Prisma flat-relation shape.

### Repository Implementation Inventory

| Service | Repository Interface | Prisma Models Involved | Complexity |
|---------|---------------------|----------------------|------------|
| ReportSectionsService | `ReportSectionsRepository` | ReportSection, ProjectStatus, Item, Risk, Decision, Priority | HIGH -- 6 models in single aggregate |
| ReviewService | `ReviewRepository` | ReportSection + User + Project (read-only join) | LOW -- single query with joins |
| PublicationService | `PublicationRepository` | Report + all section children | HIGH -- deep aggregate |
| PdfExportService | `PdfExportRepository` | Report + new PdfExportJob table | MEDIUM -- needs schema migration for job table |
| AdminService | `AdminRepository` | User, Project, Report, ReminderRule | MEDIUM -- CRUD across 4 models |
| RemindersService | `RemindersRepository` | ReminderRule + ReminderExecution (new tables) | MEDIUM -- needs schema migration |
| CarryOverService | `CarryOverRepository` | ReportSection, Item, Decision + CarryOverExecution/Record (new) | HIGH -- transactional write |
| ArchiveService | `ArchiveRepository` | Report + sections (read-only) | LOW |

### New Files (per module)

```text
  apps/api/src/modules/<domain>/
  ├── <domain>.service.ts          (EXISTS -- no change)
  ├── <domain>.service.test.ts     (EXISTS -- no change)
  ├── <domain>.router.ts           (EXISTS -- DELETE after tRPC migration)
  ├── prisma-<domain>.repository.ts (NEW -- Prisma implementation)
  └── <domain>.module.ts           (NEW -- NestJS module wiring)
```

### Prisma Schema Additions

The existing schema covers core models but is missing tables for:

| Missing Model | Used By | Purpose |
|--------------|---------|---------|
| `PdfExportJob` | PdfExportService | Track PDF generation queue jobs |
| `ReminderRule` | RemindersService | Configurable email reminder schedules |
| `ReminderExecution` | RemindersService | Deduped execution log |
| `CarryOverExecution` | CarryOverService | Deduplication of carry-over runs |
| `CarryOverRecord` | CarryOverService | Individual item/decision carry-over log |

These are currently represented only as Zod schemas in `packages/shared`. They need corresponding Prisma models and a migration.

## Integration Point 3: BullMQ Processors

### Placement Decision

BullMQ processors can run in two modes:

**Option A: Same process as NestJS (RECOMMENDED for v2)**

```text
  apps/api process
  ├── NestJS HTTP server (tRPC, auth endpoints)
  ├── BullMQ Queue registration (producers)
  └── BullMQ Processors (consumers) -- @Processor decorator
```

**Option B: Separate worker process (defer to scaling phase)**

```text
  apps/api process           apps/worker process
  ├── NestJS HTTP             ├── BullMQ consumers only
  └── BullMQ producers        └── Prisma + Playwright
```

Same-process is correct for 6 users. Separate when: (a) PDF generation memory spikes affect API latency, or (b) horizontal scaling requires independent consumer scaling.

### Queue Topology

```text
  Queues (Redis-backed)
  ├── pdf-export
  │   ├── Producer: PdfExportService.requestPdfExport() enqueues job
  │   ├── Consumer: PdfExportProcessor
  │   │   ├── Loads assembled report HTML
  │   │   ├── Renders via Playwright (headless Chromium)
  │   │   ├── Saves PDF to filesystem (local volume)
  │   │   └── Updates PdfExportJob record (status, artifactUrl, checksum)
  │   ├── Retry: 3 attempts, exponential backoff
  │   └── DLQ: pdf-export-failed
  │
  └── email-reminders
      ├── Producer: Cron job or admin trigger enqueues per-recipient jobs
      ├── Consumer: EmailReminderProcessor
      │   ├── Loads reminder rule + recipient
      │   ├── Renders email template
      │   ├── Sends via SMTP transport (nodemailer)
      │   └── Updates ReminderExecution record
      ├── Retry: 3 attempts, 30s/60s/120s delays
      └── DLQ: email-reminders-failed
```

### NestJS Integration

Uses `@nestjs/bullmq` (official NestJS integration). Queue registration in a dedicated module, processors use `@Processor` decorator.

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/queues/queues.module.ts` | BullMQ registration |
| `apps/api/src/queues/pdf-export.processor.ts` | PDF generation consumer |
| `apps/api/src/queues/email-reminder.processor.ts` | Email sending consumer |
| `apps/api/src/queues/pdf-export.producer.ts` | Job enqueueing service |
| `apps/api/src/queues/email-reminder.producer.ts` | Job enqueueing service |

## Integration Point 4: SAML Auth Flow

### Current State

Auth components exist as factory functions:
- `createSamlStrategy()` -- returns Passport SAML strategy
- `createJwtSigner()` -- signs/verifies JWT tokens
- `createSessionCookie()` -- serializes HTTP cookie
- `createRoleGuard()` -- role-based access check
- `createJwtStrategyOptions()` -- configures JWT extraction from cookie

All are pure functions. None are wired into NestJS DI or HTTP.

### Integration Flow

```text
  SAML Login Flow
  ===============

  Browser                   Next.js (web:3000)         NestJS (api:3001)         Keycloak
  │                         │                          │                         │
  │  GET /lead/report       │                          │                         │
  │ ────────────────────────>                          │                         │
  │                         │  middleware.ts checks     │                         │
  │                         │  cookie missing           │                         │
  │  302 -> /auth/saml/login│                          │                         │
  │ <────────────────────────                          │                         │
  │                         │                          │                         │
  │  GET api:3001/auth/saml/login                      │                         │
  │ ───────────────────────────────────────────────────>                         │
  │                         │                          │  302 -> Keycloak SSO    │
  │ <──────────────────────────────────────────────────│────────────────────────>│
  │                         │                          │                         │
  │  User authenticates at Keycloak                    │                         │
  │ ───────────────────────────────────────────────────────────────────────────>│
  │                         │                          │                         │
  │  POST api:3001/auth/saml/callback (SAML assertion) │                        │
  │ <────────────────────────────────────────────────────────────────────────────│
  │                         │                          │                         │
  │                         │                          │  Validate assertion     │
  │                         │                          │  Find/create User       │
  │                         │                          │  Sign JWT               │
  │                         │                          │  Set-Cookie             │
  │  302 -> original page + Set-Cookie: jwt            │                         │
  │ <──────────────────────────────────────────────────│                         │
  │                         │                          │                         │
  │  GET /lead/report (with cookie)                    │                         │
  │ ────────────────────────>                          │                         │
  │                         │  middleware passes        │                         │
  │  Page renders           │                          │                         │
  │ <────────────────────────                          │                         │
```

### NestJS Auth Module

The existing factory functions are wrapped in NestJS `useFactory` providers. The factories themselves stay as-is (pure, testable). The NestJS module just wires them into the DI container.

Key addition: `AuthService` that handles user find-or-create on SAML callback. This is the bridge between the SAML assertion profile and the Prisma `User` model.

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/modules/auth/auth.module.ts` | REWRITE from class to NestJS `@Module` decorator |
| `apps/api/src/modules/auth/auth.controller.ts` | REWRITE to NestJS `@Controller` with route handlers |
| `apps/web/src/middleware.ts` | UPDATE login redirect URL from hardcoded localhost to env var |

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/auth/auth.service.ts` | User find-or-create after SAML callback |

## Integration Point 5: Docker Compose Topology

### Service Definitions

```text
  docker-compose.yml
  │
  ├── postgres
  │   ├── image: postgres:15-alpine
  │   ├── ports: 5432:5432
  │   ├── volumes: pgdata:/var/lib/postgresql/data
  │   ├── environment: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
  │   └── healthcheck: pg_isready
  │
  ├── redis
  │   ├── image: redis:7-alpine
  │   ├── ports: 6379:6379
  │   └── healthcheck: redis-cli ping
  │
  ├── api
  │   ├── build: { context: ., dockerfile: apps/api/Dockerfile }
  │   ├── ports: 3001:3001
  │   ├── depends_on: [postgres (healthy), redis (healthy)]
  │   ├── environment: DATABASE_URL, REDIS_URL, AUTH_*, KEYCLOAK_*
  │   └── command: node dist/main.js
  │
  ├── web
  │   ├── build: { context: ., dockerfile: apps/web/Dockerfile }
  │   ├── ports: 3000:3000
  │   ├── depends_on: [api]
  │   ├── environment: NEXT_PUBLIC_API_URL
  │   └── command: node server.js (Next.js standalone output)
  │
  └── (defer) pgbouncer -- not needed for 6 users
```

### Dockerfile Strategy

Both services share the monorepo build context. Use multi-stage builds:

```text
  Stage 1: base
  ├── FROM node:20-alpine
  ├── Install pnpm
  └── Copy pnpm-workspace.yaml + all package.json files

  Stage 2: deps
  ├── pnpm install --frozen-lockfile
  └── prisma generate (platform-specific client for Linux)

  Stage 3: build
  ├── turbo prune --scope=@customreport/api (or web)
  └── turbo run build --filter=@customreport/api

  Stage 4: runtime
  ├── FROM node:20-alpine (clean)
  ├── Copy dist + production node_modules
  └── CMD ["node", "dist/main.js"]
```

Key concern: Prisma Client generation must happen inside the Docker build because the generated client is platform-specific (Linux x64 in container vs macOS arm64 on dev machine).

### New Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration |
| `docker-compose.dev.yml` | Dev overrides (volume mounts, hot reload) |
| `apps/api/Dockerfile` | API container build |
| `apps/web/Dockerfile` | Web container build |
| `.dockerignore` | Exclude node_modules, .next, .turbo |
| `.env.example` | Template for all environment variables |

## Integration Point 6: Frontend Migration (localStorage to tRPC)

### Current Data Flow

```text
  Page component ('use client')
    │
    ├── useBrowserState(serverDefault, () => readStoredLeadSection())
    │                                          └── localStorage.getItem()
    │
    ├── handleSaveDraft() --> reportSectionReadModelSchema.parse(merge)
    │                      --> persistLeadSection() --> localStorage.setItem()
    │
    └── handleSubmit() --> same pattern
```

### Target Data Flow

```text
  Page component ('use client' with tRPC hooks)
    │
    ├── const { data: section } = trpc.getActiveSection.useQuery()
    │                                 └── GET /trpc/getActiveSection
    │                                      └── api validates JWT, runs service
    │
    ├── const saveDraft = trpc.saveDraft.useMutation({
    │     onSuccess: (data) => queryClient.setQueryData(...)
    │   })
    │   saveDraft.mutate(input)  --> POST /trpc/saveDraft
    │
    └── const submitSection = trpc.submitSection.useMutation()
```

### tRPC Client Setup

```text
  apps/web/
  ├── src/lib/trpc.ts          -- createTRPCReact<AppRouter>()
  ├── src/lib/trpc-provider.tsx -- QueryClient + tRPC provider wrapper
  └── src/app/layout.tsx       -- Wrap children with TrpcProvider
```

The tRPC client sends the session cookie automatically (`httpBatchLink` with `credentials: 'include'`). No manual token management needed on the frontend.

### Migration Strategy (per page)

| Page | Current Source | Target Source | Effort |
|------|---------------|---------------|--------|
| `/lead/report` | localStorage | `trpc.getActiveSection` + `saveDraft` + `submitSection` | HIGH -- main form, autosave |
| `/head/dashboard` | localStorage (simulated) | `trpc.getSubmissionDashboard` | LOW |
| `/head/report` | localStorage (simulated) | `trpc.getAssembledReport` + `publishReport` | MEDIUM |
| `/reports/history` | none (static demo) | `trpc.listArchiveReports` | LOW |
| `/reports/[reportId]` | none (static demo) | `trpc.getArchiveReport` | LOW |
| `/admin` | localStorage (simulated) | `trpc.getAdminSnapshot` + mutations | MEDIUM |

### Files to Delete

| File | Reason |
|------|--------|
| `apps/web/src/components/report-section/section-storage.ts` | Replaced by tRPC calls |
| `apps/web/src/components/report-section/demo-section.ts` | Replaced by seed data + API |
| `apps/web/src/components/report/report-runtime.ts` | Replaced by tRPC calls |
| `apps/web/src/components/admin/admin-runtime.ts` | Replaced by tRPC calls |

### Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/lib/dev-session.ts` | Keep for local dev fallback, add env check |
| `apps/web/src/lib/use-browser-state.ts` | Keep (still useful for non-API SSR-safe state) |
| All page components under `apps/web/src/app/(app)/` | Replace localStorage with tRPC hooks |
| `apps/web/src/components/report-section/report-section-form.tsx` | Props change: remove onSaveDraft/onSubmit callbacks, use tRPC internally or pass mutations |
| `apps/web/next.config.ts` | Add `output: 'standalone'` for Docker |

## Integration Point 7: Observability Endpoints

### NestJS Health Module

```text
  apps/api/src/modules/health/
  ├── health.module.ts
  └── health.controller.ts
      ├── GET /health          -- { status: 'ok', timestamp, version }
      ├── GET /health/ready    -- checks DB + Redis connectivity
      └── GET /health/live     -- always 200 (for k8s liveness)
```

Uses `@nestjs/terminus` for standard health indicators:
- `PrismaHealthIndicator` -- `SELECT 1` on database
- `RedisHealthIndicator` -- `PING` on Redis (via ioredis)
- `BullMQHealthIndicator` -- queue connectivity check

### Structured Error Handling

The existing custom `AppLogger` is good for file logging. For HTTP errors, add:

```text
  apps/api/src/common/
  ├── domain-exception.filter.ts   -- catches domain errors, maps to tRPC error codes
  ├── trpc-error.handler.ts        -- onError callback for tRPC handler
  └── request-id.middleware.ts     -- X-Request-ID header for tracing
```

Error mapping from existing domain errors to tRPC codes:

| Domain Error | tRPC Error Code | HTTP Status |
|-------------|----------------|-------------|
| `ReportSectionDomainError` | `BAD_REQUEST` | 400 |
| `AdminAccessError` / `ReviewAccessError` / `PublicationAccessError` | `FORBIDDEN` | 403 |
| `ArchiveDomainError` (not found) | `NOT_FOUND` | 404 |
| `PdfExportDomainError` (not found) | `NOT_FOUND` | 404 |
| `PublicationAccessError` (immutable) | `CONFLICT` | 409 |
| `ReminderDomainError` | `BAD_REQUEST` | 400 |

## Component Boundary Summary

### New Components (to create)

| Component | Layer | Depends On |
|-----------|-------|-----------|
| `AppModule` | NestJS root | All modules below |
| `PrismaModule` | Infrastructure | `@prisma/client` |
| `TrpcModule` | API transport | Domain services, AuthModule |
| `AuthNestModule` | Auth | PrismaModule (user lookup) |
| `QueuesModule` | Background jobs | Redis, PrismaModule |
| `HealthModule` | Observability | PrismaModule, Redis |
| 8x `Prisma*Repository` | Data access | PrismaModule |
| tRPC client (`apps/web`) | Frontend transport | `@trpc/react-query` |
| Docker infrastructure | DevOps | All of the above |

### Modified Components (existing files that change)

| Component | Type of Change |
|-----------|---------------|
| `apps/api/src/main.ts` | REWRITE: empty bootstrap to full NestJS app |
| `apps/api/src/modules/auth/*` | REWRITE: factory functions to NestJS providers |
| `packages/shared/src/trpc/router.ts` | REWRITE: contract stubs to AppRouter type re-export |
| `prisma/schema.prisma` | EXTEND: add 5 missing models |
| All page components in `apps/web` | REWRITE: localStorage to tRPC hooks |
| `apps/web/src/middleware.ts` | UPDATE: env-driven login URL |
| `apps/web/next.config.ts` | UPDATE: add `output: 'standalone'` for Docker |

### Deleted Components

| Component | Reason |
|-----------|--------|
| `apps/api/src/modules/*/router.ts` (8 files) | Logic moves into tRPC procedures |
| `apps/web/src/components/report-section/section-storage.ts` | Replaced by tRPC |
| `apps/web/src/components/report-section/demo-section.ts` | Replaced by seed data |
| `apps/web/src/components/*/runtime.ts` files | Replaced by tRPC |

## Suggested Build Order

The build order follows dependency edges. Each phase is independently testable.

```text
  Phase 1: Database Foundation
  ├── Docker Compose (postgres + redis only)
  ├── Prisma schema additions (5 new models)
  ├── prisma migrate dev
  ├── prisma db seed (verify seed.ts works)
  └── Test: seed data queryable via prisma studio

  Phase 2: NestJS Bootstrap + Prisma Repositories
  ├── PrismaModule (PrismaService extends PrismaClient)
  ├── AppModule skeleton
  ├── main.ts rewrite (NestJS app creation + HTTP listener)
  ├── 8x Prisma repository implementations
  ├── 8x NestJS domain modules (wire service + repository)
  └── Test: services work with real DB (integration tests)

  Phase 3: tRPC Transport Layer
  ├── tRPC router (map all domain services into procedures)
  ├── tRPC context factory (session extraction from JWT cookie)
  ├── TrpcModule (mount as NestJS middleware on /trpc)
  ├── Delete old router files
  └── Test: curl /trpc/getActiveSection with dev JWT

  Phase 4: Auth Integration
  ├── AuthNestModule (NestJS module wrapping existing factories)
  ├── AuthController (/auth/saml/login, /auth/saml/callback)
  ├── AuthService (user find-or-create on SAML callback)
  ├── Update middleware.ts (env-driven login URL)
  └── Test: full SAML login flow with Keycloak dev instance

  Phase 5: Frontend Migration
  ├── tRPC client setup (createTRPCReact, provider, httpBatchLink)
  ├── Migrate /lead/report (highest value, most complex)
  ├── Migrate /head/dashboard + /head/report
  ├── Migrate /admin
  ├── Migrate /reports/history + /reports/[reportId]
  ├── Delete localStorage helpers
  └── Test: full user journey in browser against real API

  Phase 6: Background Jobs
  ├── QueuesModule (BullMQ registration)
  ├── PdfExportProcessor (Playwright PDF generation)
  ├── EmailReminderProcessor (nodemailer SMTP)
  ├── Producer services (enqueue from domain services)
  └── Test: trigger PDF export, verify file created

  Phase 7: Observability + Docker
  ├── HealthModule (/health, /health/ready, /health/live)
  ├── Domain exception filter + tRPC error mapping
  ├── Request ID middleware
  ├── Dockerfiles (api + web, multi-stage)
  ├── docker-compose.yml (full stack)
  └── Test: docker compose up, full E2E flow
```

### Build Order Rationale

1. **Database first** because every subsequent phase depends on it. Cannot test repositories without a running PostgreSQL.
2. **NestJS + repositories before tRPC** because tRPC procedures delegate to services, which need repositories. Must be testable at the service level before adding the transport layer.
3. **tRPC before auth** because we need the transport layer working to test auth flow end-to-end. During phase 3, use a dev bypass (hardcoded session in context factory when `AUTH_DEV_MODE=true`).
4. **Auth before frontend** because the frontend needs a real session cookie to call tRPC endpoints. Without auth, frontend migration can only be tested with dev bypass.
5. **Frontend after all backend** because every page depends on working tRPC endpoints. Migrating pages before the API is ready means constant blocking on backend changes.
6. **Background jobs late** because they are additive (PDF export, email) and do not block the core report workflow. The app is fully usable without them.
7. **Docker last** because it wraps everything. Building containers before the app works locally wastes debugging time in container context.

## Anti-Patterns to Avoid

### Anti-Pattern 1: NestJS DI for Everything
**What:** Wrapping every factory function in a NestJS provider just because the framework supports it.
**Why bad:** The existing auth factory functions (`createSamlStrategy`, `createJwtSigner`) are pure and testable. Over-DI-ing them adds indirection without benefit.
**Instead:** Use NestJS `useFactory` providers that call existing factories. Keep the factory functions as-is for unit testability.

### Anti-Pattern 2: Dual Validation (Zod + class-validator)
**What:** Adding NestJS DTOs with `class-validator` decorators alongside existing Zod schemas.
**Why bad:** Zod schemas in `packages/shared` are the single source of truth. Duplicating validation in class-validator means two schemas to maintain, with inevitable drift.
**Instead:** Validate exclusively with Zod via tRPC input schemas. No `class-validator` needed.

### Anti-Pattern 3: Server Components for Everything
**What:** Converting all pages from `'use client'` to RSC just because Next.js 15 supports it.
**Why bad:** The report form has complex client-side state (autosave debounce, real-time editing, multi-field validation). RSC would require a Server Action roundtrip for every keystroke.
**Instead:** Keep pages with heavy interactivity as client components. Use RSC only for read-heavy pages (archive list, published report view) where data fetching on the server is clearly better.

### Anti-Pattern 4: PgBouncer Before Needed
**What:** Adding PgBouncer to Docker Compose from day one.
**Why bad:** With 6 concurrent users and a single NestJS instance, Prisma's built-in connection pool (default 10 connections) is more than sufficient. PgBouncer adds operational complexity.
**Instead:** Add PgBouncer when scaling beyond a single API instance or when connection count exceeds PostgreSQL's `max_connections`.

### Anti-Pattern 5: Separate Worker Process Prematurely
**What:** Running BullMQ consumers in a separate Docker service from the start.
**Why bad:** PDF generation for 6 users produces maybe 1 job per week. A separate process means maintaining two build targets, two Dockerfiles, two deployment configs.
**Instead:** Run consumers in the same NestJS process. Extract to a separate service when PDF generation measurably impacts API latency.

## Scalability Considerations

| Concern | At 6 users (v2) | At 50 users | At 500 users |
|---------|-----------------|-------------|-------------|
| DB connections | Prisma pool (10) | Prisma pool (20) | PgBouncer (100 client, 20 real) |
| API instances | 1 (same process) | 1 | 2-3 behind load balancer |
| BullMQ workers | In-process | In-process | Separate worker service |
| PDF generation | Playwright in API process | Playwright in API process | Dedicated worker with queue priority |
| Redis | Single instance | Single instance | Redis Sentinel or Cluster |
| Session storage | JWT in cookie (stateless) | JWT in cookie | JWT in cookie (no session store needed) |

## Sources

- Existing codebase analysis (all files read directly from repository)
- NestJS 11 documentation (DI modules, middleware, guards)
- tRPC 11 documentation (standalone adapter, context factory pattern)
- BullMQ 5 documentation (NestJS @nestjs/bullmq integration)
- Prisma 7 documentation (client generation, migration workflow)
- @node-saml/passport-saml documentation (strategy configuration)
