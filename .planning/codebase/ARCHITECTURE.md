# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Monorepo with NestJS (DI container) + tRPC (API surface) + Next.js (frontend), using a Repository pattern with Zod-validated domain services.

**Key Characteristics:**
- NestJS provides dependency injection and module system, but NOT the HTTP API surface
- tRPC mounted as Express middleware at `/trpc` is the sole API contract for the frontend
- NestJS `@Controller` decorators are used ONLY for health checks (`/health/*`), Prometheus metrics (`/metrics`), and SAML auth routes (`/auth/*`)
- All domain logic follows Service + Repository interface pattern with Zod validation at every boundary
- Shared `@customreport/shared` package provides Zod schemas and TypeScript types as the single source of truth for data shapes
- Frontend currently uses mock data; API wiring is in progress

## Layers

**Shared Schemas (packages/shared):**
- Purpose: Single source of truth for all data types and validation rules
- Location: `packages/shared/src/`
- Contains: Zod schemas (`schemas/auth.ts`, `schemas/report.ts`), exported types, shared validation functions like `validateSubmitInput()`
- Depends on: `zod`
- Used by: Both `apps/api` and `apps/web` via `@customreport/shared`

**UI Component Library (packages/ui):**
- Purpose: Reusable shadcn/ui components and design tokens
- Location: `packages/ui/src/`
- Contains: Base UI primitives (`components/ui/*.tsx`), composition components (`data-table.tsx`, `crud-sheet.tsx`, `traffic-light-badge.tsx`, `confirm-dialog.tsx`), hooks, utility `cn()` function
- Depends on: `tailwindcss`, `@radix-ui/*`, `class-variance-authority`
- Used by: `apps/web` via `@customreport/ui`

**tRPC Infrastructure (API Gateway):**
- Purpose: Defines the full API contract, authentication middleware, and error mapping
- Location: `apps/api/src/infrastructure/trpc/`
- Contains:
  - `trpc.router.ts` - **THE** central router defining all procedures (authoritative, ~480 lines)
  - `trpc.middleware.ts` - Procedure builders: `publicProcedure`, `protectedProcedure`, `headProcedure`
  - `trpc.context.ts` - Request context creation (session extraction from JWT cookie)
  - `trpc.error-mapper.ts` - Maps domain errors to tRPC error codes
- Depends on: All domain services (injected via `RouterDeps` type)
- Used by: Express middleware mount in `main.ts`

**Domain Modules (Business Logic):**
- Purpose: Encapsulate domain logic per business capability
- Location: `apps/api/src/modules/{module-name}/`
- Contains: Service class, repository interface, Prisma repository implementation, NestJS module, domain error class, tests
- Depends on: `@customreport/shared` (schemas), `PrismaService` (data access)
- Used by: `trpc.router.ts` (via NestJS DI resolution in `main.ts`)

**NestJS Infrastructure:**
- Purpose: Dependency injection container, middleware, health checks, job queues
- Location: `apps/api/src/infrastructure/`
- Contains: Prisma service, BullMQ module, email service, health indicators, metrics, correlation ID middleware
- Depends on: `@nestjs/common`, `@nestjs/bullmq`, `@nestjs/terminus`, `prom-client`
- Used by: Domain modules (via DI)

**Next.js Frontend:**
- Purpose: Server-rendered React UI for all user roles
- Location: `apps/web/src/`
- Contains: App Router pages, domain-specific components, tRPC client setup, auth session helpers
- Depends on: `@customreport/shared`, `@customreport/ui`, `@trpc/react-query`
- Used by: End users via browser

## Domain Modules

Each module in `apps/api/src/modules/` follows the same internal pattern:

| Module | Purpose | Service | Key Operations |
|--------|---------|---------|----------------|
| `report-sections` | Lead report editing | `ReportSectionsService`, `LeadFormService` | getActiveSection, saveDraft, submitSection, fillFrom, versions, revoke, requestReopen |
| `review` | Head submission dashboard | `ReviewService` | getSubmissionDashboard |
| `publication` | Report assembly and publishing | `PublicationService` | getAssembledReport, publishReport, updateSectionForReview |
| `pdf-export` | PDF generation via BullMQ | `PdfExportService` | requestPdfExport, getPdfExportStatus, markExportCompleted |
| `admin` | User/project/period/reminder CRUD | `AdminService` | getSnapshot, upsertUser, upsertProject, upsertPeriod, getSettings, updateSettings, stageAssignments |
| `reminders` | Email reminder scheduling | `RemindersService` | requestReminderExecution, markReminderSent, listExecutions |
| `carry-over` | Cross-period item transfer | `CarryOverService` | executeCarryOver (items + decisions) |
| `archive` | Published report history | `ArchiveService` | listArchiveReports, getArchiveReport |
| `period` | Period lifecycle (publish/reopen) | `PeriodService` | publishPeriod, reopenPeriod |
| `weekly-report` | Assembled weekly report read model | `WeeklyReportService` | getWeeklyReport |
| `auth` | SAML SSO + JWT sessions | Auth controller + strategies | login, callback, logout, dev-login, JWT sign/verify |

## tRPC Router Namespaces

The central router in `apps/api/src/infrastructure/trpc/trpc.router.ts` organizes procedures into namespaces:

```
appRouter
  reports.getActive          (protectedProcedure)
  reports.myHistory          (protectedProcedure)
  reports.saveDraft          (protectedProcedure, input: draftSaveSchema)
  reports.submit             (protectedProcedure, input: submitSectionSchema)
  review.dashboard           (protectedProcedure)
  review.assembledReport     (headProcedure)
  review.publish             (headProcedure)
  pdfExport.request          (headProcedure)
  pdfExport.status           (protectedProcedure)
  admin.snapshot             (headProcedure)
  admin.getSettings          (headProcedure)
  admin.updateSettings       (headProcedure)
  admin.saveUser             (headProcedure)
  admin.saveProject          (headProcedure)
  admin.savePeriod           (headProcedure)
  admin.saveReminderRule     (headProcedure)
  admin.deleteUser           (headProcedure)
  admin.deleteProject        (headProcedure)
  admin.deleteReminderRule   (headProcedure)
  admin.saveStageAssignment  (headProcedure)
  admin.deleteStageAssignment(headProcedure)
  admin.listStageAssignments (headProcedure)
  archive.list               (protectedProcedure)
  archive.detail             (protectedProcedure)
  reminders.execute          (headProcedure)
  reminders.listExecutions   (headProcedure)
  carryOver.execute          (headProcedure)
  period.publish             (headProcedure)
  period.reopen              (headProcedure)
  weeklyReport.get           (protectedProcedure)
  leadForm.byPeriod          (protectedProcedure)
  leadForm.fillFrom          (protectedProcedure)
  leadForm.versions          (protectedProcedure)
  leadForm.restoreVersion    (protectedProcedure)
  leadForm.revoke            (headProcedure)
  leadForm.requestReopen     (protectedProcedure)
```

**Important:** Per-module router files (e.g., `report-sections.router.ts`, `review.router.ts`) exist but are NOT imported by the central `trpc.router.ts`. The central router calls services directly. Treat the module-level router files as vestigial/unused.

## Data Flow

**Lead Submits Report Section:**

1. Frontend calls `trpc.reports.saveDraft.mutate(input)` with Zod-validated payload
2. tRPC middleware checks `protectedProcedure` auth (JWT cookie -> session)
3. Central router delegates to `deps.reportSectionsService.saveDraft(input)`
4. `ReportSectionsService` validates input via `draftSaveSchema.parse()`, loads section from repository, checks business rules (not published, not already submitted), merges data
5. `ReportSectionsPrismaRepository.saveSection()` executes Prisma transaction (delete-all + recreate child entities)
6. Response flows back through tRPC, serialized via superjson

**Head Publishes Report:**

1. Frontend calls `trpc.review.publish.mutate()`
2. `headProcedure` middleware verifies role === 'head'
3. `PublicationService.publishReport()` loads assembled report, validates not already published, sets `status: 'published'`, `publishedAt`, `publishedById`
4. Persisted via `PublicationRepository.saveAssembledReport()`

**PDF Export (async):**

1. Head calls `trpc.pdfExport.request.mutate({ reportId })`
2. `PdfExportService` validates report is published, creates job record (status: 'queued')
3. Job added to BullMQ `pdf-export` queue
4. `PdfExportProcessor` (`apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`) picks up job, renders via Playwright, updates status

**State Management:**
- Server-side: PostgreSQL via Prisma (all state), Redis (BullMQ job queues)
- Session: JWT cookie (`customreport_session`), 1-hour expiry, signed with HS256
- Frontend: Currently mock data; tRPC client configured in `apps/web/src/lib/trpc.ts` with `@trpc/react-query` + superjson transformer

## Key Abstractions

**Repository Interface Pattern:**
- Purpose: Decouple domain services from data access
- Examples: `ReportSectionsRepository` in `apps/api/src/modules/report-sections/report-sections.service.ts`, `ReviewRepository` in `apps/api/src/modules/review/review.service.ts`
- Pattern: Service class defines a TypeScript `interface` for its repository. A separate `*PrismaRepository` class (decorated with `@Injectable()`) implements it. NestJS module wires them together via `useFactory`:
```typescript
// apps/api/src/modules/review/review.module.ts
{
  provide: ReviewService,
  useFactory: (repo: ReviewPrismaRepository) => new ReviewService(repo),
  inject: [ReviewPrismaRepository],
}
```

**Domain Error Classes:**
- Purpose: Typed error signaling from service to router
- Examples: `ReportSectionDomainError`, `ReviewAccessError`, `PublicationAccessError`, `AdminAccessError`, `PdfExportDomainError`, `ReminderDomainError`, `CarryOverDomainError`, `ArchiveDomainError`
- Pattern: Each module defines its own error class extending `Error`. The central error mapper (`apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`) translates each domain error to the appropriate tRPC error code.

**Zod Parse-at-Boundary:**
- Purpose: Runtime validation at every data boundary
- Pattern: Both service input AND output are validated with Zod `.parse()`. Repository mappers also call `.parse()` when converting Prisma rows to domain models. This ensures type safety is enforced at runtime, not just compile time.

## Entry Points

**API Server:**
- Location: `apps/api/src/main.ts`
- Triggers: `pnpm dev` (via Turborepo), Docker container start
- Responsibilities: Creates NestJS app, mounts tRPC as Express middleware at `/trpc`, mounts SAML auth routes, mounts BullBoard UI, starts HTTP listener on `env.PORT` (default 3001)

**Web Server:**
- Location: `apps/web/src/app/layout.tsx` (root layout), `apps/web/src/proxy.ts` (Next.js middleware)
- Triggers: `pnpm dev` (via Turborepo), Docker container start
- Responsibilities: Renders React pages via App Router, proxies auth redirects via `proxy.ts` (replaces middleware.ts in Next.js 16)

**BullMQ Processors:**
- Location: `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`, `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`
- Triggers: Jobs added to Redis queues
- Responsibilities: PDF generation via Playwright, email sending via SMTP

## Authentication & Authorization

**Authentication Flow:**
- SAML SSO via Keycloak IdP (`@node-saml/passport-saml`)
- Routes: `GET /auth/saml/login` (initiate), `POST /auth/saml/callback` (consume assertion), `POST /auth/logout`, `GET /auth/dev-login` (dev mode only)
- On successful SAML callback, `buildUserSession()` in `apps/api/src/modules/auth/auth.routes.ts` upserts the user in PostgreSQL, auto-creates weekly report sections for leads, and issues a signed JWT cookie
- JWT: HS256, 1-hour expiry, stored in `customreport_session` httpOnly cookie

**Authorization (3 tiers):**
- `publicProcedure` - No auth required (currently unused in router)
- `protectedProcedure` - Any authenticated user (leads, heads, viewers)
- `headProcedure` - Head role only (admin, publication, period lifecycle, PDF export)
- Defined in `apps/api/src/infrastructure/trpc/trpc.middleware.ts`

**Roles:** `lead` (fills report sections), `head` (reviews, publishes, admin), `viewer` (read-only access to published reports)

## Error Handling

**Strategy:** Domain errors bubble up from services, get mapped to tRPC error codes in the central router via `mapDomainError()`.

**Patterns:**
- Every router procedure wraps service calls in `try/catch` and calls `mapDomainError(error)` before rethrowing
- Domain errors map to HTTP-equivalent codes: `ReportSectionDomainError` -> `BAD_REQUEST`, `ReviewAccessError`/`AdminAccessError` -> `FORBIDDEN`, `PublicationAccessError` -> `CONFLICT`, `PdfExportDomainError`/`ArchiveDomainError` -> `NOT_FOUND`
- Unknown errors become `INTERNAL_SERVER_ERROR` with generic message (no leak)
- Error mapper: `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`

## Cross-Cutting Concerns

**Logging:** Custom structured JSON logger (`apps/api/src/lib/logger.ts`) with level-based filtering, optional file rotation (14-day retention), child logger support. Services accept optional `AppLogger` (defaults to `NullLogger` for testing).

**Correlation IDs:** `CorrelationIdMiddleware` (`apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`) injects `x-request-id` header on every request.

**Health Checks:** `/health/live` (memory heap < 200MB), `/health/ready` (database + Redis + BullMQ + memory) via `@nestjs/terminus` in `apps/api/src/infrastructure/health/health.controller.ts`.

**Metrics:** Prometheus endpoint at `/metrics` via `prom-client` in `apps/api/src/infrastructure/metrics/metrics.controller.ts`.

**Validation:** Zod schemas in `@customreport/shared` are the single source of truth. All inputs validated with `.parse()` at service entry. All outputs validated with `.parse()` before return.

**Environment Config:** Zod-validated `env.schema.ts` (`apps/api/src/infrastructure/config/env.schema.ts`) validates all env vars at boot. Process exits on invalid config.

## Database Schema

Prisma schema at `prisma/schema.prisma` (monorepo root). Key models:

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `User` | System users (leads, head, viewer) | -> ReportSection[], Project[], StageAssignment[] |
| `Project` | Products/projects led by leads | -> User (lead), ProjectStatus[], Item[], Risk[] |
| `Report` | Weekly report period container | -> ReportSection[], PdfExportJob[], ReminderRule[] |
| `ReportSection` | One lead's contribution to a report | -> User (author), Report, ProjectStatus[], Item[], Risk[], Decision[], Priority[], VersionSnapshot[] |
| `ProjectStatus` | Traffic light per project per section | Unique on [reportSectionId, projectId] |
| `Item` | Current/next week work items | -> ReportSection, Project |
| `Risk` | Project risks with impact/mitigation | -> ReportSection, Project |
| `Decision` | Management decisions with deadlines | -> ReportSection |
| `Priority` | Ranked priorities per section | Unique on [reportSectionId, rank] |
| `PdfExportJob` | Async PDF generation tracking | -> Report |
| `ReminderRule` | Scheduled email reminder rules | -> Report, ReminderExecution[] |
| `ReminderExecution` | Individual reminder send tracking | -> ReminderRule |
| `CarryOverExecution` | Cross-period item transfer tracking | -> Report (source), Report (target) |
| `VersionSnapshot` | Autosave history (JSON data) | -> ReportSection |
| `Stage` | SDLC pipeline stages | -> StageAssignment[] |
| `StageAssignment` | User-stage-project ownership | -> User, Stage, Project |
| `AppSettings` | Singleton application config | None |

---

*Architecture analysis: 2026-04-24*
