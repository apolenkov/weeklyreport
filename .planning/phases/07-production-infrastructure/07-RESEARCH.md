# Phase 7: Production Infrastructure - Research

**Researched:** 2026-04-11
**Domain:** BullMQ job processing, Docker Compose orchestration, PgBouncer pooling, health/metrics endpoints
**Confidence:** HIGH

## Summary

Phase 7 transforms the existing NestJS+Next.js monorepo into a production-ready containerized stack with async job processing, operational health monitoring, and connection pooling. The codebase already has complete domain services for PDF export and email reminders (with repository pattern, Zod validation, and tRPC routes) -- this phase adds the async execution layer (BullMQ workers), the containerization layer (Docker Compose with `turbo prune`), and the observability layer (health checks, Prometheus metrics, graceful shutdown).

The three critical pitfalls are: (1) Redis must use `noeviction` memory policy for BullMQ (default `allkeys-lru` silently destroys job metadata), (2) Docker builds must use `turbo prune --docker` to avoid copying the entire monorepo and to handle `workspace:*` protocol correctly, and (3) PgBouncer must run in transaction mode with `max_prepared_statements > 0` and Prisma migrations must bypass PgBouncer via `DIRECT_URL`.

**Primary recommendation:** Wire BullMQ into the existing NestJS DI container via `@nestjs/bullmq`, create workers for PDF and email jobs, containerize with multi-stage Docker builds using `turbo prune --docker`, and add `@nestjs/terminus` health checks with prom-client metrics.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion (pure infrastructure phase).

### Claude's Discretion
All implementation choices. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key pitfalls to address:
- Pitfall #4: Redis `noeviction` policy for BullMQ (default `allkeys-lru` destroys job metadata)
- Pitfall #6: `workspace:*` in Docker -- use `turbo prune` for monorepo Docker builds

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOBS-01 | BullMQ registered with Redis connection (noeviction policy) | `@nestjs/bullmq` BullModule.forRoot with Redis connection; Redis `--maxmemory-policy noeviction` in docker-compose |
| JOBS-02 | PDF export processor generates PDF via Playwright and stores artifact | WorkerHost processor consuming from pdf-export queue; Playwright `page.pdf()` in headless Chromium |
| JOBS-03 | Email reminder processor sends via SMTP with deduplication | WorkerHost processor consuming from email-reminder queue; nodemailer transporter; existing dedupeKey in RemindersService |
| JOBS-04 | Bull Board admin UI accessible to head role for queue monitoring | `@bull-board/api` + `@bull-board/express` mounted at `/admin/queues` with role guard |
| JOBS-05 | Failed jobs go to dead-letter queue with configurable retry | BullMQ `attempts` + `backoff` config; `deadLetterQueue` option on worker |
| DOCK-01 | Multi-stage Dockerfile for apps/api (turbo prune + pnpm) | 4-stage Dockerfile: alpine base, turbo prune, pnpm install + build, minimal runner |
| DOCK-02 | Multi-stage Dockerfile for apps/web (turbo prune + pnpm) | 4-stage Dockerfile with Next.js `output: 'standalone'` for minimal runner image |
| DOCK-03 | docker-compose.yml orchestrates PostgreSQL, Redis, PgBouncer, API, Web | 5 services + PgBouncer sidecar; named volumes for data persistence |
| DOCK-04 | docker-compose.dev.yml adds volume mounts and hot reload for development | Override file with bind mounts, `node --watch` for API, `next dev` for web |
| DOCK-05 | Health-check-based startup ordering (DB ready -> migrate -> API -> Web) | `depends_on` with `condition: service_healthy`; pg_isready / redis-cli ping healthchecks |
| DOCK-06 | PgBouncer configured with transaction mode and max_prepared_statements | PgBouncer 1.22+ in transaction mode; `max_prepared_statements = 256`; Prisma uses DIRECT_URL for migrations |
| OBS-01 | Health check endpoints (/health/live, /health/ready) checking DB + Redis + memory | `@nestjs/terminus` HealthModule with PrismaHealthIndicator, Redis indicator, MemoryHealthIndicator |
| OBS-02 | Prometheus metrics endpoint (/metrics) | `prom-client` with default metrics + custom counters; Express middleware on `/metrics` |
| OBS-03 | Graceful shutdown drains connections on SIGTERM | `app.enableShutdownHooks()` + `onModuleDestroy` in PrismaService (already exists) + BullMQ worker.close() |
| OBS-04 | Request logging with correlation IDs | Middleware generating `x-request-id` UUID; injected into AppLogger child context per request |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/bullmq` | 11.0.4 | NestJS BullMQ integration | Official NestJS queue module; provides `@Processor`, `@InjectQueue`, `BullModule.forRoot` |
| `bullmq` | 5.73.4 | Redis-backed job queue | De facto Node.js queue standard; FIFO, priority, retry, DLQ, repeatable jobs |
| `@bull-board/api` | 6.21.0 | Queue monitoring dashboard API | Official Bull Board; visual job inspection, retry, delete |
| `@bull-board/express` | 6.21.0 | Express adapter for Bull Board | Mounts Bull Board as Express middleware |
| `@nestjs/terminus` | 11.1.1 | Health check framework | Official NestJS health check module; Kubernetes-ready liveness/readiness probes |
| `prom-client` | 15.1.3 | Prometheus metrics client | De facto Node.js Prometheus client; default metrics + custom counters/histograms |
| `nodemailer` | 8.0.5 | SMTP email sending | Industry standard Node.js email library; pool mode, TLS, transporter reuse |
| `playwright` | 1.59.1 | PDF generation via headless browser | Already a project devDep; smaller PDFs than Puppeteer (59-125KB vs 197KB) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/nodemailer` | 8.0.0 | TypeScript types for nodemailer | Always with nodemailer in TS project |
| `ioredis` | (via bullmq) | Redis client | Transitive dep of bullmq; used for health check indicator |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@nestjs/terminus` | Custom health controller | Terminus provides standardized format, memory/disk indicators for free |
| `prom-client` | `@willsoto/nestjs-prometheus` | Wrapper adds NestJS DI but prom-client is simpler for 1 metrics endpoint |
| `nodemailer` | `@nestjs-modules/mailer` | Mailer module adds template engine overhead; nodemailer is sufficient for simple SMTP |
| Bull Board Express | Standalone Bull Board Docker | Express mount keeps it in-process with role-based access control |

**Installation:**
```bash
# From monorepo root
pnpm add -F @customreport/api @nestjs/bullmq bullmq @bull-board/api @bull-board/express @nestjs/terminus prom-client nodemailer
pnpm add -D -F @customreport/api @types/nodemailer
```

## Architecture Patterns

### Recommended Project Structure (additions to existing)

```
apps/api/src/
  infrastructure/
    bullmq/
      bullmq.module.ts          # BullModule.forRoot + registerQueue
      pdf-export.processor.ts   # @Processor('pdf-export') extends WorkerHost
      email-reminder.processor.ts # @Processor('email-reminder') extends WorkerHost
    health/
      health.module.ts          # HealthModule with terminus
      health.controller.ts      # /health/live, /health/ready
      prisma.health.ts          # Custom PrismaHealthIndicator
      redis.health.ts           # Custom RedisHealthIndicator
    metrics/
      metrics.module.ts         # Prometheus registry setup
      metrics.controller.ts     # /metrics endpoint
    middleware/
      correlation-id.middleware.ts  # x-request-id generation
    email/
      email.service.ts          # Nodemailer transporter wrapper

# Docker files at monorepo root
Dockerfile.api                  # Multi-stage for apps/api
Dockerfile.web                  # Multi-stage for apps/web
docker-compose.yml              # Production: PG + Redis + PgBouncer + API + Web
docker-compose.dev.yml          # Dev override: bind mounts + hot reload
.dockerignore                   # Exclude node_modules, .next, .git
pgbouncer/
  pgbouncer.ini                 # PgBouncer configuration
  userlist.txt                  # PgBouncer auth file
```

### Pattern 1: BullMQ Processor with NestJS DI

**What:** Job processors are NestJS providers that extend WorkerHost, receiving injected services.
**When to use:** All async job processing (PDF export, email reminders).

```typescript
// Source: BullMQ NestJS docs (https://docs.bullmq.io/guide/nestjs)
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('pdf-export')
export class PdfExportProcessor extends WorkerHost {
  constructor(
    private readonly pdfExportService: PdfExportService,
  ) {
    super();
  }

  async process(job: Job<{ reportId: string; jobId: string }>): Promise<void> {
    // 1. Launch Playwright browser
    // 2. Navigate to report HTML page
    // 3. Generate PDF via page.pdf()
    // 4. Save to filesystem
    // 5. Call pdfExportService.markExportCompleted()
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    // Log failure, update job status in DB
  }
}
```

### Pattern 2: Queue Service Injection

**What:** Services inject the BullMQ Queue to add jobs; processors consume them.
**When to use:** When tRPC endpoints need to enqueue async work.

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export class PdfExportService {
  constructor(
    @InjectQueue('pdf-export') private readonly pdfQueue: Queue,
  ) {}

  async requestPdfExport(reportId: string): Promise<PdfExportJob> {
    const job = await this.repository.createExportJob(/* ... */);
    await this.pdfQueue.add('generate', { reportId, jobId: job.jobId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    return job;
  }
}
```

### Pattern 3: Multi-Stage Docker Build with turbo prune

**What:** 4-stage Dockerfile that prunes the monorepo, installs deps, builds, then creates a minimal runner.
**When to use:** All Dockerfiles for apps in the Turborepo monorepo.

```dockerfile
# Source: Turborepo Docker guide (https://turborepo.dev/docs/guides/tools/docker)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @customreport/api --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@customreport/api

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### Pattern 4: Health Check with Custom Indicators

**What:** NestJS Terminus health controller with custom Prisma and Redis indicators.
**When to use:** `/health/live` (liveness) and `/health/ready` (readiness) endpoints.

```typescript
// Source: NestJS Terminus docs (https://docs.nestjs.com/recipes/terminus)
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
    ]);
  }
}
```

### Anti-Patterns to Avoid

- **Shared Redis instance for cache and BullMQ:** Use a dedicated Redis instance (or at minimum a separate database number) for BullMQ. Cache eviction policies conflict with queue data integrity.
- **`workspace:*` in Docker without turbo prune:** pnpm's `workspace:*` protocol resolves to symlinks locally but fails inside Docker. `turbo prune` replaces workspace references with file references in the pruned lockfile.
- **Running Prisma migrations through PgBouncer:** PgBouncer's transaction mode breaks migration's long-lived session. Always use `DIRECT_URL` for `prisma migrate deploy`.
- **Synchronous PDF generation in request handler:** PDF via Playwright takes 2-10 seconds. Must be async via BullMQ queue. The tRPC endpoint returns immediately with a job ID for polling.
- **Missing `maxRetriesPerRequest: null` on BullMQ workers:** Without this, ioredis throws errors when Redis is temporarily unavailable, crashing the worker.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health check endpoints | Custom HTTP handlers with manual DB pings | `@nestjs/terminus` | Handles timeouts, standardized response format, built-in memory/disk indicators |
| Job queue with retry | Custom Redis pub/sub with retry logic | BullMQ via `@nestjs/bullmq` | DLQ, backoff strategies, concurrency control, Bull Board UI |
| Queue monitoring dashboard | Custom admin page listing jobs | `@bull-board/express` | Real-time job status, retry/delete actions, no frontend work needed |
| Prometheus metrics collection | Manual counter tracking | `prom-client` with `collectDefaultMetrics()` | Process metrics (CPU, memory, event loop lag) for free |
| Connection pooling | Custom pg.Pool manager | PgBouncer | Battle-tested C implementation; handles thousands of connections with <100 real DB connections |
| Docker layer caching for monorepo | Manual file copying per workspace | `turbo prune --docker` | Produces pruned lockfile and workspace structure; handles `workspace:*` protocol |
| SMTP email transport | Raw `net.Socket` SMTP implementation | `nodemailer` | Connection pooling, TLS/STARTTLS, authentication, encoding edge cases |

## Common Pitfalls

### Pitfall 1: Redis noeviction Policy (CRITICAL)

**What goes wrong:** BullMQ stores job metadata, delayed job timestamps, and queue pointers in Redis. With `allkeys-lru` (Redis default), under memory pressure Redis silently evicts queue keys. Jobs disappear, delayed jobs never fire, workers stall.
**Why it happens:** Redis default eviction is designed for caching, not queuing.
**How to avoid:** Set `--maxmemory-policy noeviction` in Redis startup command. In docker-compose: `command: ["redis-server", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]`
**Warning signs:** Jobs randomly disappearing, BullMQ warning log "IMPORTANT! Eviction policy is volatile-lru"

### Pitfall 2: workspace:* Protocol in Docker

**What goes wrong:** `pnpm-lock.yaml` contains `workspace:*` references that resolve via symlinks locally. Inside Docker, the symlink targets don't exist, causing `pnpm install --frozen-lockfile` to fail.
**Why it happens:** pnpm's workspace protocol is a local development convenience that doesn't translate to Docker's isolated filesystem.
**How to avoid:** Use `turbo prune @customreport/api --docker` before Docker build. The pruned lockfile replaces workspace references with relative file paths.
**Warning signs:** `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` during Docker build.

### Pitfall 3: PgBouncer Prepared Statement Conflicts

**What goes wrong:** Prisma uses named prepared statements. In PgBouncer transaction mode (pre-1.22), prepared statements from one client leak to another client's connection, causing "prepared statement does not exist" errors.
**Why it happens:** Transaction mode reassigns connections after each transaction; prepared statements are per-connection state.
**How to avoid:** Use PgBouncer 1.22+ with `max_prepared_statements = 256` in pgbouncer.ini. This makes PgBouncer manage prepared statement namespacing across connections.
**Warning signs:** Intermittent `CODE: 26000 ERROR: prepared statement "PGBOUNCER_x" does not exist`

### Pitfall 4: Prisma Migrations Through PgBouncer

**What goes wrong:** `prisma migrate deploy` creates advisory locks and uses a long-lived session. PgBouncer in transaction mode breaks advisory locks across transactions.
**Why it happens:** PgBouncer reassigns connections between transactions; Prisma Migrate expects a single persistent connection.
**How to avoid:** Use `DIRECT_URL` (bypassing PgBouncer) for all Prisma CLI operations. In docker-compose, the migration init container connects directly to PostgreSQL.
**Warning signs:** Migration hangs or fails with lock timeout errors.

### Pitfall 5: BullMQ Worker maxRetriesPerRequest

**What goes wrong:** BullMQ requires `maxRetriesPerRequest: null` on the Redis connection for workers. Without it, ioredis throws after 20 retries during brief Redis disconnects, crashing the worker.
**Why it happens:** ioredis default retry of 20 is designed for short-lived commands, not long-running blocking connections (BRPOPLPUSH) used by workers.
**How to avoid:** Set `maxRetriesPerRequest: null` in BullModule.forRoot connection config.
**Warning signs:** Workers crash with "ReplyError: Command timed out" during Redis maintenance windows.

### Pitfall 6: Playwright in Docker Requires System Dependencies

**What goes wrong:** Playwright's Chromium needs system libraries (libglib, libnss, libatk, etc.) not present in Alpine images.
**Why it happens:** Alpine is minimal; Chromium requires X11/GTK libraries even in headless mode.
**How to avoid:** In the API Dockerfile, install Playwright deps: `RUN npx playwright install --with-deps chromium`. Or use `mcr.microsoft.com/playwright:v1.59.1-noble` as the base for the runner stage that needs PDF generation.
**Warning signs:** `Error: Failed to launch the browser process` in worker logs.

### Pitfall 7: Graceful Shutdown Order

**What goes wrong:** On SIGTERM, if NestJS shuts down the HTTP server before BullMQ workers finish processing, active jobs become stalled and must be retried.
**Why it happens:** Default NestJS shutdown doesn't wait for BullMQ worker drain.
**How to avoid:** In `beforeApplicationShutdown`, call `worker.close()` which waits for active jobs to complete (up to a timeout). Then close HTTP connections.
**Warning signs:** Jobs restarting from scratch after every deployment.

## Code Examples

### BullMQ Module Registration

```typescript
// apps/api/src/infrastructure/bullmq/bullmq.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: null, // CRITICAL for workers
      },
    }),
    BullModule.registerQueue(
      { name: 'pdf-export' },
      { name: 'email-reminder' },
    ),
  ],
  exports: [BullModule],
})
export class BullMQModule {}
```

### Docker Compose Production

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: customreport
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: customreport
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U customreport"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  pgbouncer:
    image: edoburu/pgbouncer:1.22.0
    environment:
      DATABASE_URL: postgresql://customreport:${DB_PASSWORD}@postgres:5432/customreport
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 200
      DEFAULT_POOL_SIZE: 20
      MAX_PREPARED_STATEMENTS: 256
    depends_on:
      postgres:
        condition: service_healthy

  migrate:
    build:
      context: .
      dockerfile: Dockerfile.api
    command: ["npx", "prisma", "migrate", "deploy"]
    environment:
      DATABASE_URL: postgresql://customreport:${DB_PASSWORD}@postgres:5432/customreport
    depends_on:
      postgres:
        condition: service_healthy

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      DATABASE_URL: postgresql://customreport:${DB_PASSWORD}@pgbouncer:6432/customreport
      DIRECT_URL: postgresql://customreport:${DB_PASSWORD}@postgres:5432/customreport
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      pgbouncer:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/health/live"]
      interval: 10s
      timeout: 5s
      retries: 3

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "3000:3000"

volumes:
  pgdata:
  redisdata:
```

### PgBouncer Configuration

```ini
# pgbouncer/pgbouncer.ini
[databases]
customreport = host=postgres port=5432 dbname=customreport

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
default_pool_size = 20
max_client_conn = 200
max_prepared_statements = 256
server_reset_query = DISCARD ALL
```

### Correlation ID Middleware

```typescript
// apps/api/src/infrastructure/middleware/correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-request-id'] as string) ?? randomUUID();
    req.headers['x-request-id'] = correlationId;
    res.setHeader('x-request-id', correlationId);
    next();
  }
}
```

### Prometheus Metrics Endpoint

```typescript
// apps/api/src/infrastructure/metrics/metrics.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { register, collectDefaultMetrics } from 'prom-client';
import type { Response } from 'express';

collectDefaultMetrics();

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pgbouncer=true` in Prisma URL | Remove param; use PgBouncer 1.22+ with `max_prepared_statements` | PgBouncer 1.21+ (2024) | No more prepared statement conflicts; simpler URL config |
| `turbo prune --scope=X` | `turbo prune X` (positional arg) | Turborepo 2.x (2024) | `--scope` deprecated; use package name directly |
| Puppeteer for PDF | Playwright for PDF | 2025-2026 | 42ms vs 147ms cold starts; 59-125KB vs 197KB files |
| `@nestjs/bull` (Bull v4) | `@nestjs/bullmq` (BullMQ v5) | 2024 | BullMQ is the maintained successor; better TypeScript, DLQ, flows |
| Custom health endpoints | `@nestjs/terminus` | Stable since NestJS 10 | Standardized health check format; built-in indicators |

## Open Questions

1. **PDF template rendering approach**
   - What we know: Playwright needs an HTML page to render to PDF. The existing code has `templateVersion: 'phase-2-pdf-v1'` suggesting a template system was planned.
   - What's unclear: Whether to render via the Next.js frontend URL (navigate Playwright to the published report page) or render a standalone HTML template in the API.
   - Recommendation: Render via the Next.js report page URL (e.g., `http://web:3000/reports/{id}/print`). This reuses existing React components and CSS, ensuring PDF matches the web view. The worker navigates Playwright to this URL and calls `page.pdf()`.

2. **PDF storage location**
   - What we know: Out of scope says "Filesystem volume sufficient for <1000 PDFs". Schema has `filePath` and `artifactUrl` fields.
   - What's unclear: Exact filesystem path inside Docker.
   - Recommendation: Store in a Docker named volume mounted at `/app/data/pdfs/` in the API container. Serve via a static file route or signed URL.

3. **Email template content**
   - What we know: RemindersService creates execution records with `recipientEmail` and `dedupeKey`.
   - What's unclear: What the reminder email body should contain.
   - Recommendation: Simple text email with report period, deadline, and link to the form. No template engine needed for v2.0.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Containerization | Yes | 29.2.1 | -- |
| Docker Compose | Orchestration | Yes | v5.0.2 | -- |
| Node.js | Runtime | Yes | v25.9.0 (exceeds 20.x minimum) | -- |
| pnpm | Package manager | Yes | 9.15.0 | -- |
| Turborepo | Build orchestrator | Yes (local) | via node_modules | -- |
| PostgreSQL CLI | Health checks | No (runs in Docker) | -- | pg_isready inside container |
| Redis CLI | Health checks | No (runs in Docker) | -- | redis-cli inside container |

**Missing dependencies with no fallback:**
- None -- all critical dependencies are available.

**Missing dependencies with fallback:**
- PostgreSQL and Redis run inside Docker containers; no local installation needed.

## Sources

### Primary (HIGH confidence)
- [BullMQ NestJS Guide](https://docs.bullmq.io/guide/nestjs) - Complete integration pattern with @Processor, WorkerHost
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production) - Redis noeviction, connection config, graceful shutdown
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker) - turbo prune --docker pattern
- [Turborepo Prune Reference](https://turborepo.dev/docs/reference/prune) - Command syntax, --docker flag output structure
- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer) - Transaction mode, max_prepared_statements, DIRECT_URL

### Secondary (MEDIUM confidence)
- [NestJS Terminus Health Checks](https://docs.nestjs.com/recipes/terminus) - HealthModule, indicators, controller pattern
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events) - enableShutdownHooks, onModuleDestroy, beforeApplicationShutdown
- [Optimized Docker Builds with Turborepo and PNPM](https://fintlabs.medium.com/optimized-multi-stage-docker-builds-with-turborepo-and-pnpm-for-nodejs-microservices-in-a-monorepo-c686fdcf051f) - Complete pnpm Dockerfile example
- [Next.js Standalone Docker](https://nextjs.org/docs/app/getting-started/deploying) - output: 'standalone' configuration
- [HTML to PDF Benchmark 2026](https://pdf4.dev/blog/html-to-pdf-benchmark-2026) - Playwright vs Puppeteer performance data
- [NestJS PDF Generation with Playwright](https://www.lorenstew.art/blog/nestjs-pdf-generation-playwright/) - Playwright page.pdf() pattern

### Tertiary (LOW confidence)
- [prom-client GitHub](https://github.com/siimon/prom-client) - Prometheus metrics API (stable, well-documented)
- [Nodemailer](https://nodemailer.com/) - SMTP transport, pooled connections

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified via npm registry; versions current as of April 2026
- Architecture: HIGH - Patterns verified against official NestJS and BullMQ documentation
- Pitfalls: HIGH - Each pitfall documented in official BullMQ/Prisma/PgBouncer docs with known issue references
- Docker patterns: HIGH - turbo prune --docker verified in Turborepo 2.x official docs; pnpm support confirmed

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable infrastructure stack, 30-day validity)
