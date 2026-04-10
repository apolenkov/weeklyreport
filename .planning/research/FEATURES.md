# Feature Landscape: Infrastructure Integration (v2.0)

**Domain:** Infrastructure integration for existing CustomReport domain logic
**Researched:** 2026-04-10
**Milestone:** v2.0 Infrastructure Integration
**Prior art:** v1.0 domain logic (8 services, Zod schemas, UI components, 51 unit tests) already shipped

---

## Executive Summary

This is NOT a greenfield feature list. The domain logic exists and works: 8 services with repository interfaces, shared Zod schemas, tRPC router contracts, SAML/JWT auth primitives, and a complete frontend UI running on localStorage. This milestone connects all of it to real infrastructure.

The features below are infrastructure plumbing, not user-facing product features. They are categorized by:

- **Table Stakes**: Without these, the app literally cannot run in production
- **Differentiators**: Infrastructure features that improve reliability, operability, and developer experience beyond "it works"
- **Anti-Features**: Infrastructure scope that should be explicitly deferred

**Key observation:** The existing codebase has clean separation between domain services and infrastructure. Every service accepts a `Repository` interface via constructor injection. Every router is a plain function with a typed context. This design was intentional and makes the infrastructure integration straightforward: implement repository interfaces with Prisma, wire routers into NestJS+tRPC, and replace localStorage calls with tRPC client calls.

---

## Table Stakes

Infrastructure without which the app cannot serve a single real request. Missing any = app is a prototype, not a product.

| # | Feature | Why Required | Complexity | Dependencies |
|---|---------|-------------|------------|--------------|
| T1 | **NestJS HTTP bootstrap + tRPC adapter** | The `main.ts` currently logs "bootstrap completed" and exits. Without an HTTP server, there is no API. tRPC adapter exposes the shared router contract as real HTTP endpoints. | Medium | Shared router contract (`packages/shared/src/trpc/router.ts`) |
| T2 | **Prisma repository implementations** | All 8 domain services depend on `Repository` interfaces (e.g., `ReportSectionsRepository`, `PdfExportRepository`, `RemindersRepository`). Without real implementations, services have no data persistence. | High | Prisma schema (exists), domain service interfaces (exist) |
| T3 | **Prisma migrations + seed data** | The `schema.prisma` exists but has never been migrated. Without migrations, there are no database tables. Without seed data, there are no users, projects, or reports to work with. | Low | Prisma schema (exists) |
| T4 | **Docker Compose orchestration** | PostgreSQL, Redis, API server, and web server need to run together. Without Docker Compose, every developer sets up their own environment differently, and there is no deployment path. | Medium | Dockerfiles for `apps/web` and `apps/api`, `turbo prune` for optimized images |
| T5 | **Frontend tRPC client wiring** | The frontend uses `localStorage` via `section-storage.ts` and `report-runtime.ts`. Without replacing these with tRPC client calls, the UI is a local demo, not a connected application. | Medium | T1 (NestJS+tRPC server running), shared router types |
| T6 | **SAML SSO authentication flow** | Auth primitives exist (`saml.strategy.ts`, `auth.controller.ts`, `jwt.strategy.ts`, `roles.guard.ts`). Without wiring them into NestJS middleware and exposing `/auth/saml/login` + `/auth/saml/callback` endpoints, users cannot log in. | Medium | Keycloak IdP (external, already exists in org), T1 (NestJS running) |
| T7 | **BullMQ job queue for PDF + email** | `PdfExportService` creates jobs with status `queued`. `RemindersService` creates executions with status `queued`. Without BullMQ workers processing these queues, jobs stay queued forever. | Medium | Redis (via T4), T2 (Prisma repos to read/write job state) |

### T1: NestJS HTTP Bootstrap + tRPC Adapter

**Current state:** `main.ts` creates a logger and exits. No NestJS app, no HTTP listener.

**Expected behavior:**
1. `NestFactory.create(AppModule)` bootstraps NestJS with all modules
2. tRPC adapter (via `@trpc/server/adapters/standalone` or NestJS middleware) mounts the router at `/trpc`
3. The `AppRouter` type from `packages/shared` is the contract; the API implements all procedures
4. Context factory creates `{ session: UserSession }` from JWT cookie on each request
5. Server listens on `PORT` (default 3001), logs startup with structured logger

**Implementation pattern:**
- Create `AppModule` importing `AuthModule`, `ReportModule`, `QueueModule`, `HealthModule`
- Each module wires domain services with Prisma repository implementations via NestJS DI
- tRPC context factory reads JWT from cookie, verifies with `JwtSigner.verifySession()`, returns `UserSession`
- Two approaches exist: (a) `nestjs-trpc` library with decorators, or (b) standalone tRPC adapter mounted as NestJS middleware. Approach (b) is simpler and avoids losing NestJS guards/interceptors debate.

**Complexity:** Medium (NestJS boilerplate + tRPC adapter + DI wiring)

---

### T2: Prisma Repository Implementations

**Current state:** 8 domain services define repository interfaces. Zero implementations exist.

**What needs implementing:**

| Service | Repository Interface | Key Methods | Prisma Complexity |
|---------|---------------------|-------------|-------------------|
| `ReportSectionsService` | `ReportSectionsRepository` | `getSectionById`, `saveSection` | Medium (nested includes: projects, items, risks, decisions, priorities) |
| `PdfExportService` | `PdfExportRepository` | `getPublishedReport`, `createExportJob`, `getExportJob`, `saveExportJob` | Low (single table CRUD) |
| `RemindersService` | `RemindersRepository` | `getRule`, `findExecutionByDedupeKey`, `saveExecution`, `getExecution`, `listExecutions` | Low (single table + dedupe query) |
| `ReviewService` | (inferred) | Assemble full report with all sections | High (multi-table join: Report + ReportSections + nested children) |
| `PublicationService` | (inferred) | Publish report, update status | Low (status update + timestamp) |
| `CarryOverService` | `CarryOverRepository` | Copy items/decisions between reports | Medium (transactional: read source, create targets, record audit) |
| `AdminService` | `AdminRepository` | CRUD for users, projects, periods, reminder rules | Low (standard CRUD, multiple tables) |
| `ArchiveService` | `ArchiveRepository` | Query published reports by date range | Low (filtered query + join) |

**Expected behavior:**
- Each repository class implements the interface, injects `PrismaClient` via NestJS DI
- `saveSection` uses `prisma.$transaction` to atomically upsert section + nested children (delete-then-create pattern for arrays like items, risks, decisions, priorities)
- All repositories parse output through Zod schemas before returning (matches existing service pattern)
- `CarryOverRepository` uses an explicit `$transaction` for cross-report copy

**Critical detail:** The `ReportSectionReadModel` includes flattened `projects` array with `trafficLight`. In Prisma, this is a join across `ReportSection` -> `ProjectStatus` -> `Project`. The repository must map Prisma's relational result to the flat Zod schema shape.

**Complexity:** High (8 repositories, nested relations, transactional writes)

---

### T3: Prisma Migrations + Seed Data

**Current state:** `schema.prisma` defines 9 models. No migration history. No seed script.

**Expected behavior:**
1. `prisma migrate dev --name init` creates initial migration from existing schema
2. Seed script (`prisma/seed.ts`) creates: 6 lead users, 1 head user, 1 viewer user, 6-10 projects assigned to leads, 1 current report period with deadline, empty report sections per lead
3. Seed is idempotent (upsert by email/samlId)
4. Production uses `prisma migrate deploy` (no interactive prompts)

**Seed data needed:**

| Entity | Count | Notes |
|--------|-------|-------|
| Users | 8 | 6 leads, 1 head, 1 viewer; real names from department |
| Projects | 6-10 | Assigned to leads; 1-2 projects per lead |
| Report | 1 | Current week, deadline = next Friday |
| ReportSections | 6 | One per lead, status = draft |

**Complexity:** Low (straightforward Prisma workflow)

---

### T4: Docker Compose Orchestration

**Current state:** No Docker files exist.

**Expected behavior:**

```text
docker-compose.yml
  ├── postgres (PostgreSQL 15, volume for data persistence)
  ├── redis (Redis 7, for BullMQ + sessions)
  ├── api (NestJS, depends on postgres + redis)
  ├── web (Next.js, depends on api)
  └── migrate (one-shot: prisma migrate deploy + seed)
```

**Implementation details:**
- Use `turbo prune --scope=api --docker` to create minimal Docker context for each app
- Multi-stage Dockerfiles: (1) base with pnpm, (2) install deps, (3) build, (4) production runtime
- `migrate` service runs `prisma migrate deploy && prisma db seed` then exits
- Health checks on postgres (pg_isready) and redis (redis-cli ping) before API starts
- Environment variables via `.env` file (not baked into images)
- Network: all services on same Docker network, no port exposure except web (3000) and api (3001)

**Turborepo Docker optimization:** `turbo prune` creates a minimal `./out` directory with only the workspace and its dependencies. This dramatically reduces Docker build context and layer cache invalidation.

**Complexity:** Medium (multi-stage builds, dependency ordering, health checks)

---

### T5: Frontend tRPC Client Wiring

**Current state:** All data access goes through `localStorage` via `section-storage.ts` (lead form) and `report-runtime.ts` (head dashboard, published report, archive, PDF export).

**Expected behavior:**
1. Create `apps/web/src/trpc/client.ts` with `createTRPCNext` pointing to `http://localhost:3001/trpc`
2. Wrap `_app.tsx` (or layout) with tRPC provider + React Query provider
3. Replace each localStorage call with a tRPC procedure call:

| Current localStorage function | Replacement tRPC call | Component affected |
|-------------------------------|----------------------|-------------------|
| `readStoredLeadSection()` | `trpc.getActiveSection.useQuery()` | Lead report form |
| `persistLeadSection()` | `trpc.saveDraft.useMutation()` | Lead report form |
| `buildDraftAssembledReport()` | `trpc.getAssembledReport.useQuery()` | Head dashboard |
| `publishReportSnapshot()` | `trpc.publishReport.useMutation()` | Head dashboard |
| `readPublishedReport()` | `trpc.getPublishedReport.useQuery()` | Published report view |
| `requestPdfExport()` | `trpc.requestPdfExport.useMutation()` | PDF export button |
| `readPdfExportJob()` | `trpc.getPdfExportStatus.useQuery()` | PDF export status |
| `listArchiveReportSummaries()` | `trpc.listArchiveReports.useQuery()` | Archive list |
| `readArchiveReport()` | `trpc.getArchiveReport.useQuery()` | Archive detail |

4. Add React Query `refetchOnWindowFocus`, `staleTime: 30_000` for reasonable caching
5. Add optimistic updates for `saveDraft` (update local cache immediately, reconcile on server response)

**Key consideration:** The shared router in `packages/shared/src/trpc/router.ts` currently only defines 4 procedures. It needs extending to cover all 9+ operations above. The shared router is the type contract; the API implements it.

**Complexity:** Medium (systematic replacement, one component at a time)

---

### T6: SAML SSO Authentication Flow

**Current state:** Auth primitives exist and are tested:
- `saml.strategy.ts`: Creates Passport SAML strategy with Keycloak config
- `auth.controller.ts`: JWT signing/verification, session cookie creation
- `jwt.strategy.ts`: JWT verification options
- `roles.guard.ts`: Role-based access control guard factory
- `auth.module.ts`: Wires all dependencies from environment variables

**What is missing:** NestJS route handlers and middleware that execute the SAML flow.

**Expected SAML flow:**

```text
User visits app
    |
    v
Next.js middleware checks for session cookie
    |
    +-- Cookie valid (JWT verified) --> Proceed to app
    |
    +-- No cookie / expired --> Redirect to /auth/saml/login
                                    |
                                    v
                            NestJS redirects to Keycloak IdP
                                    |
                                    v
                            User authenticates at Keycloak
                                    |
                                    v
                            Keycloak POSTs SAML assertion to /auth/saml/callback
                                    |
                                    v
                            NestJS validates assertion (via passport-saml)
                                    |
                                    v
                            NestJS looks up/creates User in DB by samlId
                                    |
                                    v
                            NestJS signs JWT with UserSession payload
                                    |
                                    v
                            NestJS sets httpOnly cookie + redirects to app
                                    |
                                    v
                            User is authenticated (cookie sent on every request)
```

**Implementation needs:**
1. NestJS controller with `GET /auth/saml/login` (initiates SAML flow)
2. NestJS controller with `POST /auth/saml/callback` (receives IdP assertion)
3. User lookup/creation in database by `samlId` (upsert)
4. JWT session cookie set on successful auth
5. Next.js `middleware.ts` checks cookie on every request, redirects unauthenticated users
6. `AUTH_DEV_MODE=true` bypass for local development (already supported in `saml.strategy.ts`)
7. tRPC context factory extracts `UserSession` from JWT on every API call

**Complexity:** Medium (flow is well-defined, primitives exist, wiring is straightforward)

---

### T7: BullMQ Job Queue for PDF + Email

**Current state:** `PdfExportService` and `RemindersService` create `queued` records but nothing processes them.

**Expected behavior:**

**PDF Export Queue:**
1. User requests PDF export -> API creates job record (status: `queued`) + adds BullMQ job
2. BullMQ worker picks up job -> launches Playwright, navigates to report HTML page, calls `page.pdf()`
3. Worker saves PDF to filesystem (or S3-compatible storage)
4. Worker updates job record (status: `completed`, `artifactUrl`, `checksum`)
5. Frontend polls `getPdfExportStatus` -> when completed, shows download link

**Email Reminder Queue:**
1. Cron job (or admin trigger) creates reminder execution (status: `queued`) + adds BullMQ job
2. BullMQ worker picks up job -> sends email via SMTP using `nodemailer`
3. Worker updates execution record (status: `sent`, `sentAt`)
4. On failure: retry with exponential backoff (3 attempts), then mark `failed` with `errorMessage`

**NestJS integration:**
- `@nestjs/bullmq` module registers queues: `pdf-export`, `email-reminders`
- `@Processor('pdf-export')` class extends `WorkerHost`, implements `process()` method
- `@Processor('email-reminders')` class extends `WorkerHost`, implements `process()` method
- Bull Board UI at `/admin/queues` for monitoring (optional, behind auth)

**Job configuration:**
- PDF export: 2 retries, 30s timeout per attempt, 1 concurrent worker (Playwright is heavy)
- Email reminders: 3 retries, exponential backoff (3s base), 5 concurrent workers
- Both queues: dead letter queue for failed jobs after max retries

**Complexity:** Medium (BullMQ integration is well-documented, Playwright PDF is the hard part)

---

## Differentiators

Infrastructure features that go beyond "it works" to improve reliability, operability, and developer experience. Not blocking for MVP, but strongly recommended.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Health check endpoints** | `/health/live` and `/health/ready` enable Docker restart policies, load balancer routing, and future Kubernetes probes. Without them, a crashed API stays in the pool. | Low | `@nestjs/terminus` with Prisma + Redis + BullMQ indicators |
| D2 | **Structured error handling** | tRPC errors with typed codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`) instead of generic 500s. Frontend can show meaningful messages. | Low | tRPC `TRPCError` with Zod validation error mapping |
| D3 | **Request logging + correlation IDs** | Every API request gets a UUID; all log lines within that request include it. Essential for debugging "user says X happened" issues. | Low | NestJS middleware + existing structured logger |
| D4 | **Graceful shutdown** | On `SIGTERM`, finish in-flight requests, drain BullMQ workers, close Prisma connections, then exit. Without this, Docker restarts cause data corruption (partial writes). | Low | NestJS `enableShutdownHooks()` + BullMQ `Worker.close()` + `PrismaClient.$disconnect()` |
| D5 | **Rate limiting** | Protect against accidental DoS (lead's browser tab auto-saving every 100ms due to bug). Protect PDF export from queue flooding. | Low | `@nestjs/throttler` (global 100 req/min, PDF export 5 req/min) |
| D6 | **CORS configuration** | API at `:3001`, frontend at `:3000`. Without proper CORS, browser blocks every tRPC call. | Low | NestJS `app.enableCors({ origin, credentials: true })` |
| D7 | **Environment configuration module** | Centralized, validated env var loading (Zod schema for all env vars). Fail fast on startup if required vars are missing. | Low | NestJS `ConfigModule` + Zod validation schema |
| D8 | **Database connection pooling via PgBouncer** | With 6 leads + 1 head + BullMQ workers, connection pressure is low now. But PgBouncer is trivial to add via Docker Compose and prevents connection exhaustion as usage grows. | Low | Docker Compose service, `DATABASE_URL` points to PgBouncer instead of Postgres directly |

### D1: Health Check Endpoints

**Expected behavior:**

| Endpoint | Checks | Use Case |
|----------|--------|----------|
| `GET /health/live` | Process is running (always 200) | Docker `HEALTHCHECK`, Kubernetes liveness probe |
| `GET /health/ready` | Prisma connected, Redis connected, BullMQ queues responsive | Load balancer routing, Kubernetes readiness probe |

Response format:
```json
{
  "status": "ok",
  "info": { "database": { "status": "up" }, "redis": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" }, "redis": { "status": "up" } }
}
```

**Complexity:** Low (10 lines of Terminus config)

---

### D2: Structured Error Handling

**Expected behavior:**
- Domain errors (`ReportSectionDomainError`, `PdfExportDomainError`, `ReminderDomainError`) map to tRPC error codes
- Zod validation failures return `BAD_REQUEST` with field-level errors
- Auth failures return `UNAUTHORIZED` (no session) or `FORBIDDEN` (wrong role)
- Not found returns `NOT_FOUND`
- Frontend displays error messages from structured response, not "Something went wrong"

**Error mapping:**

| Domain Error | tRPC Code | HTTP Status |
|-------------|-----------|-------------|
| `SECTION_ALREADY_SUBMITTED` | `CONFLICT` | 409 |
| `MISSING_TRAFFIC_LIGHT` | `BAD_REQUEST` | 400 |
| Zod parse failure | `BAD_REQUEST` | 400 |
| Missing session cookie | `UNAUTHORIZED` | 401 |
| Role insufficient | `FORBIDDEN` | 403 |
| Entity not found | `NOT_FOUND` | 404 |
| Unexpected error | `INTERNAL_SERVER_ERROR` | 500 |

**Complexity:** Low (error middleware in tRPC context)

---

## Anti-Features

Infrastructure scope to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Kubernetes deployment** | Docker Compose is sufficient for 6 leads + 1 head + a few viewers. K8s adds complexity (Helm charts, ingress, service mesh) with zero benefit at this scale. | Docker Compose for v2.0. K8s only if usage exceeds 100 concurrent users or multi-node requirement emerges. |
| **S3/MinIO for PDF storage** | Filesystem storage in a Docker volume works for <1000 PDFs. Adding S3 means IAM, bucket policies, presigned URLs. | Store PDFs in `/data/exports/` volume mount. Migrate to S3 when storage exceeds 10GB or multi-node deployment is needed. |
| **CI/CD pipeline** | Valuable but orthogonal to "app works in production". Can be added after the infrastructure milestone without blocking any features. | Manual `docker compose up --build` for now. GitHub Actions pipeline in a follow-up milestone. |
| **Prometheus/Grafana monitoring stack** | Overkill for 8 users. Health endpoints (D1) cover "is it running?" questions. | Health check endpoints + structured logs. Add Prometheus when usage patterns need tracking. |
| **Redis Sentinel/Cluster** | Single Redis instance handles thousands of BullMQ jobs. Sentinel adds operational complexity for zero benefit at this scale. | Single Redis container. Add Sentinel if uptime SLA > 99.9% is required. |
| **Multi-environment config (staging/prod)** | One environment is enough for initial deployment. Staging adds Docker Compose profiles, separate databases, DNS entries. | Single `docker-compose.yml` with `.env` file. Add staging when team has a deployment pipeline. |
| **Database backups automation** | Important for production, but a `pg_dump` cron job is sufficient. Automated backup with point-in-time recovery is over-engineering for v2.0. | Manual `pg_dump` script documented in README. Automated backups in production hardening phase. |
| **API versioning** | tRPC does not need URL-based versioning. Schema changes are handled by Zod backwards compatibility. | No versioning. Add only if external consumers need a stable public API (unlikely for internal tool). |

---

## Feature Dependencies

```text
Infrastructure Integration Dependency Graph
============================================

T3 (Prisma migrations + seed)
    |
    v
T2 (Prisma repository implementations)
    |                                          T4 (Docker Compose)
    v                                              |
T1 (NestJS bootstrap + tRPC)                       |
    |         |         |                          |
    v         v         v                          v
T6 (SAML)  T7 (BullMQ)  T5 (Frontend tRPC)    [All services run]
    |         |           |
    v         v           v
  [Auth flow] [Jobs run] [UI connected]

Differentiators (all depend on T1):
  D1 (Health) ──── D4 (Graceful shutdown) ──── D6 (CORS)
  D2 (Errors) ──── D3 (Logging) ──── D5 (Rate limiting)
  D7 (Config) ──── D8 (PgBouncer via T4)
```

**Critical path:** T3 -> T2 -> T1 -> T5 (shortest path to "frontend talks to real database")

**Parallel work possible:**
- T4 (Docker Compose) can be built in parallel with T2 (repositories)
- T6 (SAML) can be wired after T1, in parallel with T5
- T7 (BullMQ) can be wired after T1, in parallel with T5
- All D-features can be added after T1

---

## Implementation Ordering Recommendation

### Phase 1: Database + API Foundation (critical path)

1. **T3** Prisma migrations + seed data
2. **T2** Prisma repository implementations (start with `ReportSectionsRepository` as it exercises the hardest pattern: nested relations)
3. **T1** NestJS bootstrap + tRPC adapter
4. **D7** Environment configuration (validate all env vars at startup)
5. **D6** CORS configuration (unblocks frontend connection)
6. **D2** Structured error handling (errors are meaningful from day 1)

**Exit criteria:** `curl localhost:3001/trpc/getActiveSection` returns data from PostgreSQL.

### Phase 2: Frontend Connection + Auth

7. **T5** Frontend tRPC client wiring (replace localStorage calls)
8. **T6** SAML SSO authentication flow
9. **D1** Health check endpoints
10. **D3** Request logging + correlation IDs

**Exit criteria:** User logs in via Keycloak, sees their report section with data from DB.

### Phase 3: Async Jobs + Production Readiness

11. **T7** BullMQ job queue (PDF export + email reminders)
12. **T4** Docker Compose orchestration
13. **D4** Graceful shutdown
14. **D5** Rate limiting
15. **D8** PgBouncer

**Exit criteria:** `docker compose up` starts everything; PDF export works end-to-end.

---

## Complexity Summary

| Category | Count | Total Complexity |
|----------|-------|-----------------|
| Table Stakes | 7 | 3 High + 4 Medium = substantial effort |
| Differentiators | 8 | 8 Low = quick wins |
| Anti-Features | 8 | 0 (explicitly deferred) |

**Effort estimate:** Table stakes are 80% of the work. Differentiators are quick bolt-ons after the foundation is in place. The hardest single feature is T2 (Prisma repositories) because it touches all 8 domain services and requires mapping relational Prisma results to flat Zod schemas.

---

## Sources

- Existing codebase analysis: `apps/api/src/modules/*/`, `packages/shared/src/`, `prisma/schema.prisma`
- [NestJS tRPC monorepo patterns](https://www.tomray.dev/nestjs-nextjs-trpc) (Tom Ray, updated 2023)
- [nestjs-trpc-v2](https://github.com/mguay22/nestjs-trpc-v2) (NestJS-native tRPC integration)
- [BullMQ + NestJS Guide](https://docs.bullmq.io/guide/nestjs) (official BullMQ docs)
- [NestJS Queues documentation](https://docs.nestjs.com/techniques/queues) (official NestJS docs)
- [Prisma + NestJS integration](https://docs.nestjs.com/recipes/prisma) (official NestJS recipe)
- [Prisma repository pattern discussion](https://github.com/prisma/prisma/discussions/10584)
- [Turborepo Docker deployment](https://turborepo.dev/docs/guides/tools/docker) (official Turborepo docs)
- [NestJS Health Checks with Terminus](https://docs.nestjs.com/recipes/terminus) (official NestJS docs)
- [tRPC Next.js App Router setup](https://trpc.io/docs/client/nextjs) (official tRPC docs)
- [NestJS SAML SSO with Keycloak](https://www.loginradius.com/enterprise-sso/keycloak/nestjs)
- [NestJS SAML 2.0 Authentication gist](https://gist.github.com/andreacioni/eb5bad0bcca18cf4fb732c6d7e29e3e8)

---

*Last updated: 2026-04-10 (v2.0 infrastructure integration research)*
