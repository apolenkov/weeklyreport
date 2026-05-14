# External Integrations

**Analysis Date:** 2026-04-24

## 2026-05-14 Refresh

Current integration surface:

- GitHub Enterprise: PR #5 and Actions CI are active; current run 277113 is
  queued with Markdown Lint and Lint, Typecheck & Unit Tests checks.
- tRPC is the primary frontend/backend API contract; Next.js proxies /trpc
  requests to the API service.
- Auth uses SAML/JWT plus dev-login/dev role switching for local UAT.
- PDF export uses BullMQ plus Playwright and persists PdfExportJob state.
- Reminders use BullMQ, SMTP/nodemailer, reminder policies, derived rules, and
  execution dedupe.
- Observability includes Prometheus metrics, Grafana dashboard JSON, OTel, and
  log-sink docs.
- AI and Telegram are seed-mode/deferred activation surfaces; no real provider
  or token activation is part of v8.1 closure.

## APIs & External Services

**tRPC API (internal):**

- The API server exposes a tRPC endpoint at `/trpc` consumed by the Next.js frontend
- Router definition: `apps/api/src/infrastructure/trpc/trpc.router.ts`
- Context factory: `apps/api/src/infrastructure/trpc/trpc.context.ts`
- Middleware (auth guards): `apps/api/src/infrastructure/trpc/trpc.middleware.ts`
- Client setup: `apps/web/src/lib/trpc.ts`
- Transport: `httpBatchLink` with `superjson` transformer, cookies included (`credentials: 'include'`)

**Next.js Rewrites (proxy):**

- `/trpc/:path*` -> `${API_URL}/trpc/:path*`
- `/auth/:path*` -> `${API_URL}/auth/:path*`
- `/health/:path*` -> `${API_URL}/health/:path*`
- Config: `apps/web/next.config.ts`

## Data Storage

**PostgreSQL:**

- Provider: PostgreSQL 15+ (configured via Prisma datasource)
- Connection: `DATABASE_URL` env var (format: `postgresql://user:pass@host:port/db`)
- Optional direct connection: `DIRECT_URL` env var (for migrations bypassing connection pooler)
- Client: Prisma 7 with `@prisma/adapter-pg` driver adapter
- Connection pooling: `pg.Pool` (Node.js native `pg` library), instantiated in `apps/api/src/infrastructure/prisma/prisma.service.ts`
- Schema: `prisma/schema.prisma` (20 models, 11 enums)
- Migrations: `prisma/migrations/` (managed via `prisma migrate`)
- Seed: `prisma/seed.ts` (6 leads, 1 head, 1 viewer, 6 projects, 2 report periods, 7 SDLC stages, app settings singleton)
- Health check: `apps/api/src/infrastructure/health/prisma.health.ts` (executes `SELECT 1`)

**File Storage:**

- Local filesystem only
- PDF files stored at `/app/data/pdfs` (Docker) or `PDF_OUTPUT_DIR` env var
- Created by `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
- Served as `/pdfs/{jobId}.pdf` artifact URLs

**Caching:**

- No application-level caching layer detected
- Redis is used exclusively as BullMQ queue backend, not for data caching

## Job Queue (BullMQ)

**Redis Backend:**

- Connection: `REDIS_HOST` (default: `localhost`) + `REDIS_PORT` (default: `6379`)
- Client: `ioredis` ^5.10.1
- Config: `apps/api/src/infrastructure/bullmq/bullmq.module.ts`
- `maxRetriesPerRequest: null` (required for BullMQ worker compatibility)
- No Redis AUTH configured (relies on Docker network isolation)

**Queue: `pdf-export`:**

- Job data: `{ reportId: string, jobId: string }`
- Processor: `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
- Workflow: Launches headless Chromium via Playwright, navigates to `${PDF_BASE_URL}/reports/${reportId}/print`, generates A4 PDF, writes to disk, computes SHA-256 checksum, updates job status
- Service: `apps/api/src/modules/pdf-export/pdf-export.service.ts`
- Worker: Raw `Worker` class (not `@Processor` decorator -- workaround for `@nestjs/bullmq` 11 DiscoveryService DI bug)

**Queue: `email-reminder`:**

- Job data: `{ executionId: string, recipientEmail: string, reportPeriod: string }`
- Processor: `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts`
- Workflow: Sends reminder email via SMTP, marks execution as sent
- Service: `apps/api/src/modules/reminders/reminders.service.ts`
- Worker: Raw `Worker` class (same DI bug workaround)

**Bull Board (Monitoring UI):**

- Mounted at `/admin/queues`
- Config: `apps/api/src/infrastructure/bullmq/bull-board.module.ts`
- Protected: JWT auth, head role required
- Shows both `pdf-export` and `email-reminder` queues

## Authentication & Identity

**Auth Provider: Keycloak via SAML 2.0:**

- Strategy: `@node-saml/passport-saml` ^5.1.0
- Implementation: `apps/api/src/modules/auth/saml.strategy.ts`
- SAML signature: SHA-256 (both signature and digest algorithms)
- Assertion validation: `wantAssertionsSigned: true`, `wantAuthnResponseSigned: true`
- Clock skew tolerance: 5 seconds
- In-response-to validation: `always` in production, `never` in dev mode

**SAML Routes:**

- `GET /auth/saml/login` - Initiates SAML login flow (redirects to Keycloak)
- `POST /auth/saml/callback` - Processes SAML assertion, creates/updates user, issues JWT cookie
- `POST /auth/logout` - Clears session cookie
- `GET /auth/dev-login` - Dev-only bypass (accepts `?role=lead|head|viewer&email=...`)
- Route config: `apps/api/src/modules/auth/auth.routes.ts`

**JWT Sessions:**

- Library: `jsonwebtoken` ^9.0.2
- Algorithm: HS256
- Expiry: 1 hour
- Cookie name: `customreport_session` (configurable via `AUTH_JWT_COOKIE_NAME`)
- Cookie flags: `httpOnly`, `secure` (production only), `sameSite: lax`, `path: /`
- Controller: `apps/api/src/modules/auth/auth.controller.ts`
- JWT strategy: `apps/api/src/modules/auth/jwt.strategy.ts` (extracts from cookie)

**User provisioning:**

- Auto-create on first SAML login (user upserted in `buildUserSession()` in `auth.routes.ts`)
- Profile fields from SAML: `nameID` (samlId), `email`, `displayName`, `role`
- Roles: `lead`, `head`, `viewer` (stored in PostgreSQL `User.role` enum)

**Dev mode:**

- Enabled by `AUTH_DEV_MODE=true`
- tRPC context falls back to a hardcoded head session when no cookie present
- Dev login endpoint available at `/auth/dev-login`

**RBAC:**

- tRPC middleware defines three procedure levels:
  - `publicProcedure` - No auth required
  - `protectedProcedure` - Any authenticated user
  - `headProcedure` - Head role only
- Guard: `apps/api/src/modules/auth/roles.guard.ts`

## Email (SMTP)

**Service:** `apps/api/src/infrastructure/email/email.service.ts`

- Library: `nodemailer` ^8.0.5
- Production: Connects to corporate SMTP server
- Development: Uses `jsonTransport` (logs email payload to stdout, no actual sending)
- From address: `SMTP_FROM` env var (default: `noreply@example.com`)

**SMTP Configuration:**

- `SMTP_HOST` - SMTP server hostname (absence triggers dev mode)
- `SMTP_PORT` - SMTP server port (default: 587)
- `SMTP_USER` - SMTP username (optional, skips auth if absent)
- `SMTP_PASS` - SMTP password
- `SMTP_FROM` - Sender email address

## Monitoring & Observability

**Health Checks:**

- Framework: `@nestjs/terminus` ^11.1.1
- Controller: `apps/api/src/infrastructure/health/health.controller.ts`
- Liveness: `GET /health/live` - Memory heap check (200MB threshold)
- Readiness: `GET /health/ready` - Database + Redis + BullMQ + memory checks
- Indicators:
  - `apps/api/src/infrastructure/health/prisma.health.ts` - `SELECT 1` query
  - `apps/api/src/infrastructure/health/redis.health.ts` - `PING` command (own ioredis instance)
  - `apps/api/src/infrastructure/health/bullmq.health.ts` - BullMQ queue health

**Metrics:**

- Framework: `prom-client` ^15.1.3
- Endpoint: `GET /metrics` (Prometheus text format)
- Controller: `apps/api/src/infrastructure/metrics/metrics.controller.ts`
- Collects: Node.js default metrics (event loop lag, GC stats, heap usage, etc.)

**Logging:**

- Custom structured JSON logger: `apps/api/src/lib/logger.ts`
- Format: JSON lines to stdout (info/debug/warn) and stderr (error)
- File logging: Optional, daily rotation with configurable retention (default: 14 days)
- Log file pattern: `customreport-YYYY-MM-DD.log`
- Service name field: `customreport-api`
- Configurable min level via `LOG_LEVEL` env var

**Request Tracing:**

- Correlation ID middleware: `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`
- Reads `x-request-id` header or generates UUID
- Sets `x-request-id` on response

**Error Tracking:**

- No external error tracking service detected (no Sentry, Datadog, etc.)

## CI/CD & Deployment

**Hosting:**

- Docker containers (two images: `Dockerfile.api` and `Dockerfile.web`)
- No Docker Compose file detected in the repository
- Kubernetes mentioned as future target in CLAUDE.md

**CI Pipeline:**

- No CI configuration detected (no `.github/workflows/`, no `.gitlab-ci.yml`)

**Playwright E2E Config:**

- Config: `apps/web/playwright.config.ts`
- Starts web dev server on port 3100 for tests
- Projects: `setup` (auth state) -> `chromium` (journey tests)
- CI mode: retries 2, workers 1, github reporter

## Environment Configuration

**Required env vars (production):**

- `DATABASE_URL` - PostgreSQL connection string (validated: must start with `postgresql://`)
- `AUTH_JWT_SECRET` - JWT signing key (min 32 chars, required when `AUTH_DEV_MODE` is not `true`)
- `KEYCLOAK_SAML_CALLBACK_URL` - SAML callback URL (required in production)
- `KEYCLOAK_SAML_ENTRY_POINT` - Keycloak SAML entry point URL (required in production)
- `KEYCLOAK_SAML_ISSUER` - SAML issuer identifier (required in production)
- `KEYCLOAK_SAML_CERT` - IdP certificate for assertion validation (required in production)

**Optional env vars:**

- `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
- `PORT` - API server port (default: 3001)
- `NODE_ENV` - `development` | `production` | `test` (default: `development`)
- `FRONTEND_URL` - Frontend origin for CORS and redirects (default: `http://localhost:3000`)
- `AUTH_DEV_MODE` - Enable dev auth bypass (default: `false`)
- `AUTH_JWT_COOKIE_NAME` - Session cookie name (default: `customreport_session`)
- `LOG_LEVEL` - `debug` | `info` | `warn` | `error` (default: `info`)
- `LOG_DIR` - Directory for log file rotation (file logging disabled if absent)
- `REDIS_HOST` - Redis hostname (default: `localhost`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `SMTP_HOST` - SMTP server (absence triggers dev/mock mode)
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `SMTP_FROM` - Sender address (default: `noreply@example.com`)
- `PDF_BASE_URL` - Base URL for PDF renderer (default: `http://localhost:3000`)
- `PDF_OUTPUT_DIR` - PDF file storage path (default: `/app/data/pdfs`)
- `NEXT_PUBLIC_API_URL` - API URL for Next.js rewrites (default: `http://localhost:3001`)

**Env validation:**

- Source of truth: `apps/api/src/infrastructure/config/env.schema.ts`
- Uses Zod schema with `superRefine` for cross-field validation
- Validated at bootstrap before server starts (exits with code 1 on failure)

**Secrets location:**

- `.env` file at monorepo root (loaded via Node.js `--env-file` flag in API dev script, `dotenv/config` in Prisma config and seed)
- No `.env` files detected in the repository (gitignored)

## Webhooks & Callbacks

**Incoming:**

- `POST /auth/saml/callback` - Receives SAML assertion from Keycloak IdP after user login

**Outgoing:**

- None detected

## PDF Generation

**Approach:**

- Server-side HTML-to-PDF using Playwright Chromium
- The PDF processor navigates to the Next.js print page (`/reports/{reportId}/print`)
- Generates A4 format with print backgrounds
- Docker API image uses `mcr.microsoft.com/playwright:v1.59.0-noble` base image (~1.4GB) for pre-installed Chromium
- PDF files stored locally with SHA-256 checksum verification
- Job triggered via tRPC `pdfExport.request` mutation (head role only)

## Integration Architecture Summary

```
                   Keycloak (SAML IdP)
                        |
                  SAML assertion
                        |
    [Browser] --cookie--> [Next.js :3000] --rewrite--> [NestJS :3001]
                              |                             |
                              |                      tRPC + Express
                              |                             |
                              |                    +--------+--------+
                              |                    |                 |
                              |              [PostgreSQL]      [Redis]
                              |                    |                 |
                              |              Prisma 7 +       BullMQ queues:
                              |              pg adapter        - pdf-export
                              |                                - email-reminder
                              |                                     |
                              |                              +------+------+
                              |                              |             |
                              |                        [Chromium]    [SMTP Server]
                              |                         PDF gen       Email send
                              |
                        /reports/{id}/print
                         (rendered by Next.js,
                          captured by Playwright)
```

---

_Integration audit: 2026-04-24_
