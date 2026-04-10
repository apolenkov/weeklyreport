# Technology Stack: v2.0 Infrastructure Integration

**Project:** CustomReport
**Milestone:** v2.0 Infrastructure Integration
**Researched:** 2026-04-10
**Overall confidence:** HIGH (verified against npm registry, official docs, codebase audit)

---

## Scope

This document covers ONLY the new libraries and integration patterns needed
for the v2.0 milestone. It does NOT re-research the base stack (Next.js 15.5,
NestJS 11, Prisma 7, Zod 4, tRPC 11, shadcn/ui, Vitest, Playwright,
Turborepo, pnpm) -- those are validated and documented in the v1.0 STACK.md
and CLAUDE.md.

---

## 1. NestJS + tRPC Adapter

### Current State

The codebase has a **stub architecture**:
- `packages/shared/src/trpc/router.ts` defines a tRPC router contract using
  `initTRPC.create()` with Zod schemas (4 procedures: getActiveSection,
  saveDraft, submitSection, getSubmissionDashboard)
- `apps/api/src/modules/*/` has hand-rolled router objects (plain functions,
  not tRPC procedures) and domain services with repository interfaces
- `apps/api/src/main.ts` is an empty bootstrap -- no NestJS HTTP module, no
  Express app, no tRPC mounted

### Recommended Approach: tRPC Express Middleware on NestJS

**Use tRPC's official Express adapter** (`@trpc/server/adapters/express`)
mounted onto NestJS's underlying Express instance. Do NOT use third-party
NestJS-tRPC wrapper libraries.

| Package | Version | Purpose |
|---------|---------|---------|
| `@trpc/server` | `^11.16.0` | Already installed. tRPC server + Express adapter |
| `@trpc/client` | `^11.16.0` | NEW. Frontend tRPC client for Next.js |
| `@trpc/next` | `^11.16.0` | NEW. Next.js-specific tRPC integration (optional, can use vanilla client) |
| `@nestjs/platform-express` | `^11.1.0` | NEW. Required to bootstrap NestJS HTTP server on Express |

**Why NOT nestjs-trpc (v2.9.1) or trpc-nestjs-adapter (alpha)?**

- `nestjs-trpc` (5K weekly downloads, 1K GitHub stars) adds a decorator layer
  (`@Router`, `@Query`, `@Mutation`) and a Rust CLI that auto-generates tRPC
  schema from NestJS. This is an unnecessary abstraction -- the codebase
  already has tRPC routers defined in `packages/shared`. Adding another
  schema generation layer creates double-maintenance.
- `trpc-nestjs-adapter` is stuck at `1.0.0-alpha.12` (no releases in 12+
  months). Dead project.
- The official tRPC Express adapter is stable, zero-dependency (part of
  `@trpc/server`), and the approach recommended by tRPC maintainers for
  non-Next.js backends.

**Integration Pattern:**

```typescript
// apps/api/src/main.ts (simplified)
import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Express } from 'express';

const app = await NestFactory.create(AppModule);
const expressApp = app.getHttpAdapter().getInstance() as Express;

// Mount tRPC at /trpc path prefix
expressApp.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => createContext({ req, res, app }),
  }),
);

await app.listen(3001);
```

The `createContext` function bridges NestJS DI with tRPC context -- it resolves
NestJS providers (PrismaService, AuthService) and passes them to tRPC
procedures. This pattern allows tRPC procedures to call domain services that
are injected via NestJS.

**Confidence:** HIGH -- official tRPC adapter, battle-tested pattern, codebase
already has the router contract.

### What NOT to Add

- `nestjs-trpc` or `@mguay/nestjs-trpc` -- adds decorator-based schema
  generation that conflicts with existing `packages/shared` router contract
- `@trpc/react-query` -- NOT needed. Use `@trpc/client` with vanilla fetch
  or `@trpc/next` for SSR. React Query adds unnecessary weight for this app
  (6 leads, not a high-traffic SPA)
- REST controllers alongside tRPC -- the only REST endpoints should be the
  SAML auth callback routes (Passport requires Express routes)

---

## 2. Prisma 7 Repository Pattern for NestJS

### Current State

All 8 domain services define repository interfaces (e.g.,
`ReportSectionsRepository`, `RemindersRepository`) with async methods. Services
receive repositories via constructor injection. Tests use in-memory
implementations. No Prisma Client code exists yet.

### Recommended Approach: Thin PrismaService + Concrete Repositories

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | `^7.0.0` | NEW. Generated Prisma Client for PostgreSQL |
| `prisma` | `^7.0.0` | NEW (devDependency). CLI for migrations, generate |

**Pattern: Injectable PrismaService as NestJS provider**

```typescript
// apps/api/src/infrastructure/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Each domain module gets a concrete repository implementation:

```typescript
// apps/api/src/modules/report-sections/report-sections.prisma-repository.ts
@Injectable()
export class ReportSectionsPrismaRepository
  implements ReportSectionsRepository {

  constructor(private readonly prisma: PrismaService) {}

  async getSectionById(id: string) { /* Prisma query */ }
  async saveSection(section: ReportSectionReadModel) { /* Prisma upsert */ }
}
```

NestJS module wires interface to implementation:

```typescript
// In the module providers array:
{
  provide: 'ReportSectionsRepository',
  useClass: ReportSectionsPrismaRepository,
}
```

**Transactions:** Use Prisma interactive transactions (`prisma.$transaction`)
for multi-table operations (e.g., saving a report section with its items,
risks, and decisions atomically).

**Connection pooling:** Prisma 7 manages its own internal connection pool.
With PgBouncer in front, set `connection_limit=1` in the Prisma connection
URL to let PgBouncer handle pooling:

```
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/customreport?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://user:pass@postgres:5432/customreport"
```

The `DIRECT_URL` bypasses PgBouncer for migrations (Prisma Migrate needs a
direct connection, not transaction-pooled).

**Confidence:** HIGH -- this is the standard NestJS + Prisma pattern documented
by both NestJS and Prisma officially.

### What NOT to Add

- `nestjs-prisma` wrapper package -- unnecessary abstraction over the 10-line
  PrismaService class above
- Generic repository base class with generics -- Prisma's generated client
  provides per-model type safety that a generic base class erases. Keep
  repositories concrete per domain
- `@prisma/extension-*` packages -- not needed for this use case

---

## 3. Docker Compose for Monorepo

### Current State

No Dockerfiles or docker-compose files exist.

### Recommended Approach: Turborepo Prune + Multi-Stage Builds

| Component | Image | Version |
|-----------|-------|---------|
| PostgreSQL | `postgres:15-alpine` | 15.x |
| Redis | `redis:7-alpine` | 7.x |
| PgBouncer | `bitnami/pgbouncer:latest` | 1.22+ |
| NestJS API | Custom multi-stage | Node 22-alpine |
| Next.js Web | Custom multi-stage | Node 22-alpine |

**Docker Compose structure:**

```
docker/
  docker-compose.yml          # Production-like
  docker-compose.dev.yml      # Development overrides (hot reload)
  api.Dockerfile              # NestJS multi-stage
  web.Dockerfile              # Next.js multi-stage (standalone output)
  pgbouncer/
    pgbouncer.ini             # PgBouncer config
    userlist.txt              # PgBouncer auth
```

**Multi-stage Dockerfile pattern for Turborepo + pnpm:**

```dockerfile
# Stage 1: Prune monorepo to only API workspace
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN npx turbo prune @customreport/api --docker

# Stage 2: Install dependencies
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Stage 3: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@customreport/api

# Stage 4: Production
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

**Key decisions:**
- `turbo prune --docker` creates a minimal workspace tree for each app
- `pnpm install --frozen-lockfile` ensures deterministic installs
- Node 22-alpine for smaller image size (~180MB vs ~900MB full)
- Next.js uses `output: 'standalone'` for minimal production image

**Confidence:** HIGH -- Turborepo Docker guide is official, pnpm + multi-stage
is well-documented.

### What NOT to Add

- Kubernetes manifests -- out of scope for v2.0
- Nginx reverse proxy -- not needed when Docker Compose exposes ports directly
- Custom health check scripts in Docker -- NestJS Terminus handles this at
  application level

---

## 4. SAML Authentication: @node-saml/passport-saml + NestJS

### Current State

The codebase has **well-built auth foundations**:
- `saml.strategy.ts` -- creates SAML strategy with full Keycloak config
- `jwt.strategy.ts` -- JWT extraction from cookies
- `roles.guard.ts` -- role-based access control guard (pure function)
- `auth.controller.ts` -- JWT signing/verification + session cookies
- `auth.module.ts` -- wires everything together

All of this is implemented as **pure functions/classes** not yet connected to
NestJS DI or HTTP server.

### Recommended Approach: Wire Existing Code into NestJS Guards

| Package | Version | Purpose |
|---------|---------|---------|
| `@node-saml/passport-saml` | `^5.1.0` | Already installed |
| `@nestjs/passport` | `^11.0.5` | Already installed |
| `passport` | `^0.7.0` | Already installed |
| `passport-jwt` | `^4.0.1` | Already installed |
| `jsonwebtoken` | `^9.0.2` | Already installed |
| `@nestjs/platform-express` | `^11.1.0` | NEW (needed for HTTP) |
| `helmet` | `^8.0.0` | NEW. Security headers |
| `@nestjs/config` | `^4.0.0` | NEW. Environment variable management |

**Integration pattern:**

The existing pure-function auth code needs to be wrapped in NestJS
constructs:

1. **SAML routes** -- Express routes (not tRPC) because Passport SAML
   requires HTTP redirects (`/auth/saml/login` -> Keycloak ->
   `/auth/saml/callback`). These are 2 plain Express routes, NOT tRPC
   procedures.

2. **JWT Guard** -- NestJS `@UseGuards(JwtAuthGuard)` on tRPC middleware
   context creation. Every tRPC request extracts JWT from cookie, validates
   it, and puts `UserSession` into tRPC context.

3. **Role Guard** -- The existing `createRoleGuard` becomes a tRPC middleware
   that checks `ctx.session.role` against required roles.

```typescript
// tRPC middleware for auth (in appRouter)
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { session: ctx.session } });
});

const isHead = t.middleware(({ ctx, next }) => {
  if (ctx.session?.role !== 'head') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

const protectedProcedure = t.procedure.use(isAuthed);
const headProcedure = t.procedure.use(isAuthed).use(isHead);
```

**Dev mode bypass:** The existing `AUTH_DEV_MODE=true` pattern is preserved.
In dev mode, the SAML callback is mocked to return a test user without
requiring a running Keycloak instance.

**Confidence:** HIGH -- all auth code already exists, just needs NestJS
wiring. `@node-saml/passport-saml` v5.1.0 is current stable.

### What NOT to Add

- `nest-keycloak-connect` -- designed for OpenID Connect, not SAML. The
  codebase uses SAML which is an organization requirement
- `@nestjs/jwt` -- not needed. The codebase already has `jsonwebtoken`
  with a clean wrapper. Adding @nestjs/jwt is a second JWT library for
  no benefit
- NextAuth.js / Auth.js -- weak SAML support, designed for external OAuth
  providers. Wrong tool for corporate SAML SSO
- Refresh token rotation -- v2.0 uses simple 1-hour JWT expiry. Add refresh
  tokens in v3.0 if session length is a complaint

---

## 5. BullMQ + NestJS (@nestjs/bullmq)

### Current State

- `reminders.service.ts` has full domain logic for scheduling reminder
  executions with dedup
- `pdf-export.service.ts` has PDF generation domain logic
- Neither is wired to actual queue infrastructure
- BullMQ is referenced in CLAUDE.md but not installed

### Recommended Approach

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/bullmq` | `^11.0.0` | NestJS BullMQ integration module |
| `bullmq` | `^5.0.0` | BullMQ core (peer dependency) |
| `@bull-board/api` | `^6.20.0` | Bull Board API (for admin dashboard) |
| `@bull-board/nestjs` | `^6.20.0` | NestJS Bull Board integration |
| `@bull-board/express` | `^6.20.0` | Express adapter for Bull Board UI |

**Queue design (3 queues):**

| Queue | Job Type | Priority | Retry | DLQ |
|-------|----------|----------|-------|-----|
| `pdf-export` | Generate PDF from report HTML | Normal | 3 retries, exponential backoff | Yes |
| `email` | Send reminder emails via SMTP | Normal | 5 retries, 60s delay | Yes |
| `report-assembly` | Assemble full report from sections | Low | 2 retries | No |

**Module setup:**

```typescript
// apps/api/src/infrastructure/queue.module.ts
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue(
      { name: 'pdf-export' },
      { name: 'email' },
      { name: 'report-assembly' },
    ),
  ],
})
export class QueueModule {}
```

**Processor pattern:**

```typescript
@Processor('pdf-export')
export class PdfExportProcessor extends WorkerHost {
  constructor(
    private readonly pdfService: PdfExportService,
    private readonly prisma: PrismaService,
  ) { super(); }

  async process(job: Job<{ reportId: string }>): Promise<string> {
    // 1. Fetch report data from Prisma
    // 2. Render HTML template
    // 3. Generate PDF via Playwright
    // 4. Store PDF (filesystem or S3)
    // 5. Return PDF URL
  }
}
```

**Bull Board** -- mounted at `/admin/queues` behind the head role guard.
Provides visual monitoring of all 3 queues, job statuses, retry/replay.

**Confidence:** HIGH -- `@nestjs/bullmq` v11.0.4 is official NestJS package,
BullMQ v5 is the standard Node.js queue.

### What NOT to Add

- `bull` (predecessor) -- unmaintained, BullMQ is the successor
- `@nestjs/schedule` for email reminders -- use BullMQ repeatable jobs
  instead. One queue system, not two
- Custom Redis pub/sub for job notifications -- BullMQ handles this internally
- Separate worker process -- for 6 users, co-located workers in the API
  process are sufficient. Extract to separate process when queue depth
  exceeds 100 jobs/minute

---

## 6. Observability: Health Checks + Metrics

### Current State

No health checks or metrics exist. The API has a structured JSON logger
(`apps/api/src/lib/logger.ts`) already built.

### Recommended Approach

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/terminus` | `^11.1.0` | Health check framework |
| `@willsoto/nestjs-prometheus` | `^6.0.0` | Prometheus metrics for NestJS |
| `prom-client` | `^15.0.0` | Prometheus client (peer dep) |

**Health checks (3 indicators):**

| Indicator | Endpoint | What It Checks |
|-----------|----------|----------------|
| Database | `/health` | Prisma `$queryRaw('SELECT 1')` |
| Redis | `/health` | Redis `PING` |
| Memory | `/health` | Heap usage < 200MB |

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory', 200 * 1024 * 1024),
    ]);
  }
}
```

**Prometheus metrics:**

Default Node.js metrics (CPU, memory, event loop lag, GC) are collected
automatically by `@willsoto/nestjs-prometheus`. Custom metrics:

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_duration_seconds` | Histogram | method, route, status |
| `bullmq_jobs_total` | Counter | queue, status (completed/failed) |
| `report_submissions_total` | Counter | role |
| `pdf_generation_duration_seconds` | Histogram | - |

Exposed at `GET /metrics` (Prometheus scrape endpoint). Protected behind
internal-only access (not exposed to frontend).

**Confidence:** HIGH -- `@nestjs/terminus` is official NestJS, prom-client
is the de facto Prometheus client for Node.js.

### What NOT to Add

- Grafana/Prometheus Docker containers in v2.0 -- the app exposes `/metrics`,
  the infrastructure team connects their existing monitoring stack
- OpenTelemetry (`@nestjs/opentelemetry`) -- overkill for a single-service
  app with 6 users. Add if distributed tracing is needed later
- Sentry error tracking -- consider for v3.0, not v2.0. Structured logging
  covers error visibility for now
- Custom access log middleware -- NestJS + Express + Helmet already log
  requests. Use the existing structured logger

---

## 7. PgBouncer in Docker Compose

### Current State

No PgBouncer configuration exists.

### Recommended Approach

| Component | Image | Config |
|-----------|-------|--------|
| PgBouncer | `bitnami/pgbouncer:latest` | Transaction mode, 20 pool size |

**Docker Compose service:**

```yaml
pgbouncer:
  image: bitnami/pgbouncer:latest
  environment:
    POSTGRESQL_HOST: postgres
    POSTGRESQL_PORT: 5432
    POSTGRESQL_USERNAME: customreport
    POSTGRESQL_PASSWORD: ${DB_PASSWORD}
    POSTGRESQL_DATABASE: customreport
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_DEFAULT_POOL_SIZE: 20
    PGBOUNCER_MAX_CLIENT_CONN: 200
    PGBOUNCER_MAX_PREPARED_STATEMENTS: 100
  ports:
    - "6432:6432"
  depends_on:
    postgres:
      condition: service_healthy
```

**Connection strings:**

```env
# App connects through PgBouncer (transaction mode)
DATABASE_URL="postgresql://customreport:${DB_PASSWORD}@pgbouncer:6432/customreport?pgbouncer=true&connection_limit=1"

# Prisma Migrate connects directly (needs session-level features)
DIRECT_URL="postgresql://customreport:${DB_PASSWORD}@postgres:5432/customreport"
```

**Key settings:**
- `PGBOUNCER_POOL_MODE=transaction` -- required by Prisma
- `PGBOUNCER_MAX_PREPARED_STATEMENTS=100` -- Prisma 7 uses prepared
  statements by default. Setting this > 0 allows PgBouncer to manage them
  (PgBouncer 1.21+). For PgBouncer < 1.21, add `?pgbouncer=true` to URL
  which disables prepared statements
- `connection_limit=1` in Prisma URL -- lets PgBouncer manage the pool
  instead of Prisma's internal pool competing with it

**Dev vs Prod:**
- **Dev:** Skip PgBouncer. Connect directly to PostgreSQL (`localhost:5432`).
  PgBouncer adds complexity with zero benefit for a single-developer setup
- **Prod:** PgBouncer mandatory. Handles connection reuse across NestJS
  restart cycles and BullMQ worker connections

**Confidence:** HIGH -- Prisma + PgBouncer is officially documented, bitnami
image is well-maintained, transaction mode is standard.

### What NOT to Add

- pgpool-II -- more complex, designed for read replicas and load balancing.
  PgBouncer is simpler and sufficient
- Connection pooling at application level (Prisma pool) when PgBouncer is
  present -- use `connection_limit=1` to avoid double-pooling
- Redis Sentinel/Cluster -- single Redis instance is sufficient for 6 users

---

## Complete New Dependencies Summary

### apps/api (production dependencies)

```bash
pnpm --filter=@customreport/api add \
  @nestjs/platform-express@^11.1.0 \
  @nestjs/config@^4.0.0 \
  @nestjs/terminus@^11.1.0 \
  @nestjs/bullmq@^11.0.0 \
  bullmq@^5.0.0 \
  helmet@^8.0.0 \
  @willsoto/nestjs-prometheus@^6.0.0 \
  prom-client@^15.0.0 \
  @bull-board/api@^6.20.0 \
  @bull-board/nestjs@^6.20.0 \
  @bull-board/express@^6.20.0
```

### apps/api (dev dependencies)

```bash
pnpm --filter=@customreport/api add -D \
  @prisma/client@^7.0.0 \
  prisma@^7.0.0
```

Note: Prisma Client is a dev dependency because it's generated code.
The `@prisma/client` runtime is included in the generated output.
Actually, for Prisma 7, `@prisma/client` should be a production dependency
and `prisma` (CLI) is the dev dependency:

```bash
pnpm --filter=@customreport/api add @prisma/client@^7.0.0
pnpm --filter=@customreport/api add -D prisma@^7.0.0
```

### apps/web (production dependencies)

```bash
pnpm --filter=@customreport/web add \
  @trpc/client@^11.16.0
```

### Root (dev dependencies)

```bash
pnpm add -D prisma@^7.0.0
```

(Prisma CLI at root for running migrations from monorepo root.)

---

## What NOT to Add (Anti-Recommendations)

These were considered and explicitly rejected:

| Package/Tool | Why Not |
|--------------|---------|
| `nestjs-trpc` / `nestjs-trpc-v2` | Adds decorator-based schema generation that conflicts with existing `packages/shared` tRPC router contract |
| `trpc-nestjs-adapter` | Alpha, abandoned (no release in 12+ months) |
| `@trpc/react-query` | Unnecessary weight. Vanilla `@trpc/client` with Next.js RSC is simpler and lighter |
| `@nestjs/jwt` | Already have `jsonwebtoken` with clean wrappers. Two JWT libraries for no benefit |
| `nest-keycloak-connect` | OpenID Connect focused, not SAML. Wrong auth protocol |
| `NextAuth.js` / `Auth.js` | Weak SAML support. Designed for external OAuth, not corporate IdP |
| `nestjs-prisma` | 10-line PrismaService doesn't need a wrapper package |
| `@nestjs/typeorm` | Listed in v1.0 STACK.md install commands by mistake. Prisma is the ORM, not TypeORM |
| `@nestjs/schedule` | BullMQ repeatable jobs handle scheduling. One queue system, not two |
| `@nestjs/opentelemetry` | Overkill for single-service, 6-user app |
| `@sentry/node` | Structured logging covers v2.0 error visibility |
| `nestjs-pino` / `winston` | Already have custom structured logger in `src/lib/logger.ts` |
| `nginx` / `traefik` | Not needed with Docker Compose direct port exposure |
| `pgpool-II` | PgBouncer is simpler and sufficient |
| `Redis Sentinel` | Single Redis node is sufficient |
| Kubernetes manifests | Out of scope for v2.0 |

---

## Integration Topology

```
                          Docker Compose Network
  +----------------------------------------------------------------+
  |                                                                  |
  |  +----------+     +----------+     +-----------+                 |
  |  | Next.js  |     | NestJS   |     | BullMQ    |                 |
  |  | Web      |---->| API      |---->| Workers   |                 |
  |  | :3000    |tRPC | :3001    |     | (in-proc) |                 |
  |  +----------+     +----+-----+     +-----------+                 |
  |                        |                |                        |
  |                   +----+----+     +-----+-----+                  |
  |                   |PgBouncer|     |   Redis    |                  |
  |                   |  :6432  |     |   :6379    |                  |
  |                   +----+----+     +-----------+                  |
  |                        |                                         |
  |                   +----+------+                                  |
  |                   |PostgreSQL |                                  |
  |                   |   :5432   |                                  |
  |                   +-----------+                                  |
  +----------------------------------------------------------------+

  External: Keycloak IdP (SAML SSO) -- corporate infrastructure
  External: SMTP server -- corporate email relay
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| tRPC Express adapter on NestJS | **HIGH** | Official adapter, standard pattern, codebase already has router contract |
| Prisma 7 + NestJS repositories | **HIGH** | Officially documented by both NestJS and Prisma |
| Docker Compose + Turborepo | **HIGH** | Official Turborepo Docker guide, well-documented patterns |
| SAML auth wiring | **HIGH** | All auth code already built, just needs NestJS HTTP wiring |
| @nestjs/bullmq | **HIGH** | Official NestJS package, v11.0.4 current |
| @nestjs/terminus health | **HIGH** | Official NestJS package, v11.1.1 current |
| Prometheus metrics | **MEDIUM-HIGH** | `@willsoto/nestjs-prometheus` is community package (not official NestJS) but widely used and stable |
| PgBouncer + Prisma | **HIGH** | Officially documented by Prisma, bitnami image battle-tested |

---

## Sources

- [tRPC Express Adapter (official)](https://trpc.io/docs/server/adapters/express)
- [tRPC Adapters Overview](https://trpc.io/docs/server/adapters)
- [NestJS + Prisma Recipe (official)](https://docs.nestjs.com/recipes/prisma)
- [Prisma 7 + PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [BullMQ + NestJS Guide (official BullMQ docs)](https://docs.bullmq.io/guide/nestjs)
- [NestJS Queues (official)](https://docs.nestjs.com/techniques/queues)
- [@nestjs/bullmq on npm](https://www.npmjs.com/package/@nestjs/bullmq) -- v11.0.4
- [@nestjs/terminus on npm](https://www.npmjs.com/package/@nestjs/terminus) -- v11.1.1
- [@willsoto/nestjs-prometheus on GitHub](https://github.com/willsoto/nestjs-prometheus)
- [Turborepo Docker Guide (official)](https://turborepo.dev/docs/guides/tools/docker)
- [Turborepo Prune for Docker](https://turbo.build/repo/docs/handbook/deploying-with-docker)
- [bitnami/pgbouncer Docker Image](https://hub.docker.com/r/bitnami/pgbouncer)
- [@node-saml/passport-saml on GitHub](https://github.com/node-saml/passport-saml)
- [@bull-board/nestjs on npm](https://www.npmjs.com/package/@bull-board/nestjs) -- v6.20.6
- [Node.js PostgreSQL Connection Pooling with PgBouncer](https://earezki.com/ai-news/2026-04-06-your-nodejs-app-is-probably-killing-your-postgresql-connection-pooling-explained/)
- [NestJS-tRPC (evaluated, rejected)](https://nestjs-trpc.io/)
- [Optimized Multi-Stage Docker Builds with TurboRepo and PNPM](https://fintlabs.medium.com/optimized-multi-stage-docker-builds-with-turborepo-and-pnpm-for-nodejs-microservices-in-a-monorepo-c686fdcf051f)

---

*Last updated: 2026-04-10 (v2.0 infrastructure research)*
