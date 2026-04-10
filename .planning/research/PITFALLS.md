# Domain Pitfalls: CustomReport v2.0 Infrastructure Integration

**Domain:** Adding infrastructure to an existing domain-logic app
**Researched:** 2026-04-10
**Milestone:** v2.0 Infrastructure Integration

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or complete feature failures. Prevention is mandatory.

### Pitfall 1: PgBouncer Prepared Statement Conflict with Prisma

**What goes wrong:**
- Prisma generates prepared statements for every query by default
- PgBouncer in transaction mode (pre-1.21) does not track prepared statements across transactions
- Queries fail with `prepared statement "sX" does not exist` errors
- Happens intermittently under load (when PgBouncer assigns a different backend connection), making it hard to reproduce locally

**Why it happens:**
- Developer sets up PgBouncer for connection pooling (correct decision) but does not configure Prisma to work with it
- PgBouncer < 1.21 has no prepared statement support in transaction mode
- PgBouncer >= 1.21 supports prepared statements but requires `max_prepared_statements > 0` in pgbouncer.ini
- Prisma docs recommend `?pgbouncer=true` for older PgBouncer but this flag is NOT needed for PgBouncer 1.21+

**Consequences:**
- Random query failures in production (works 90% of the time, fails 10%)
- Connection pool exhaustion as failed queries hold connections
- Application appears unstable under load

**Prevention:**
- Use PgBouncer 1.22+ (current stable) with `max_prepared_statements = 256` in pgbouncer.ini
- Do NOT add `?pgbouncer=true` to DATABASE_URL if using PgBouncer 1.21+
- Set `pool_mode = transaction` (required for Prisma)
- Use separate `directUrl` for Prisma migrations (bypasses PgBouncer)

```prisma
// schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // PgBouncer: postgres://...@pgbouncer:6432/db
  directUrl = env("DIRECT_DATABASE_URL") // Direct: postgres://...@postgres:5432/db
}
```

```ini
# pgbouncer.ini
[pgbouncer]
pool_mode = transaction
max_prepared_statements = 256
default_pool_size = 20
max_client_conn = 100
```

**Detection:**
- Load test: 50 concurrent queries through PgBouncer. Any `prepared statement does not exist` error = this pitfall
- Check PgBouncer version: must be >= 1.21 for prepared statement support

**Phase:** Docker Compose setup (earliest infrastructure phase)
**Confidence:** HIGH (Prisma docs + PgBouncer 1.21 changelog confirm)

**Sources:**
- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [PgBouncer 1.21 Prepared Statement Support](https://pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode)

---

### Pitfall 2: Prisma Migration Runs Through PgBouncer (Fails Silently)

**What goes wrong:**
- `prisma migrate deploy` runs through PgBouncer (uses DATABASE_URL)
- Migrations use DDL statements (CREATE TABLE, ALTER TABLE) which require a single persistent connection
- PgBouncer in transaction mode may reassign the backend connection mid-migration
- Migration partially applies, leaving database in inconsistent state
- Next migration run fails because some tables exist, others do not

**Why it happens:**
- Developer sets DATABASE_URL to PgBouncer address (correct for app runtime)
- Forgets that Prisma CLI commands (migrate, seed, studio) need a DIRECT connection
- Docker Compose entrypoint runs `prisma migrate deploy` using the same DATABASE_URL

**Consequences:**
- Corrupted database schema (partial migrations)
- `prisma migrate deploy` stuck in failed state
- Manual SQL intervention required to recover
- Data loss if migration includes destructive changes

**Prevention:**
- ALWAYS use `directUrl` in schema.prisma (see Pitfall 1 code example)
- Docker Compose migration command must use DIRECT_DATABASE_URL:

```yaml
# docker-compose.yml
services:
  api:
    environment:
      DATABASE_URL: postgresql://user:pass@pgbouncer:6432/customreport
      DIRECT_DATABASE_URL: postgresql://user:pass@postgres:5432/customreport
    command: >
      sh -c "
        npx prisma migrate deploy &&
        node dist/main.js
      "
```

- Prisma CLI automatically uses `directUrl` when defined in schema.prisma
- Test: run `prisma migrate deploy` in Docker Compose, verify it connects to postgres:5432 (not pgbouncer:6432)

**Detection:**
- Check Docker logs during migration: connection target must be postgres container, not pgbouncer
- If migration takes abnormally long or times out, PgBouncer is likely intercepting

**Phase:** Prisma setup / Docker Compose
**Confidence:** HIGH (Prisma official docs document this requirement)

**Sources:**
- [Prisma Database Connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)

---

### Pitfall 3: NestJS Guards/Interceptors Bypassed by tRPC Adapter

**What goes wrong:**
- Developer adds `@UseGuards(JwtGuard, RolesGuard)` to NestJS controller
- tRPC endpoints are mounted via an Express/Fastify middleware adapter, NOT through NestJS controller layer
- NestJS guards, interceptors, pipes, and exception filters do NOT apply to tRPC routes
- All tRPC endpoints are effectively unprotected -- no auth, no role checks, no error formatting

**Why it happens:**
- tRPC operates at the Express/Fastify middleware level, below NestJS's decorator-based pipeline
- The `trpc-nestjs-adapter` or `nestjs-trpc` packages mount tRPC as raw middleware
- NestJS DI container is not involved in tRPC request processing unless explicitly wired
- Developer tests with NestJS-decorated endpoints (which work), assumes tRPC endpoints are equally protected

**Consequences:**
- Authentication bypass on ALL tRPC endpoints (security vulnerability)
- Error responses have inconsistent format (tRPC errors vs NestJS HttpExceptions)
- Logging middleware does not capture tRPC requests
- Role-based access control is completely non-functional

**Prevention:**
- Implement auth and role checks as tRPC middleware, NOT NestJS guards:

```typescript
// trpc/middleware.ts
import { TRPCError } from '@trpc/server';

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const hasRole = (role: Role) =>
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user.role !== role && ctx.user.role !== 'head') {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx });
  });

// Use in router
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const headProcedure = protectedProcedure.use(hasRole('head'));
```

- Create a tRPC context factory that extracts user from JWT:

```typescript
// trpc/context.ts
export async function createContext({ req }: { req: Request }) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = token ? await verifyJwt(token) : null;
  return { user, prisma };
}
```

- Map tRPC errors to consistent format using onError handler
- NEVER rely on NestJS @UseGuards for tRPC routes

**Detection:**
- Security test: call any tRPC endpoint without Authorization header. If it returns data instead of 401 = this pitfall
- Code review: if tRPC router has no `.use(isAuthenticated)` middleware, auth is missing

**Phase:** NestJS + tRPC integration (early)
**Confidence:** HIGH (tRPC docs + NestJS-tRPC community docs confirm this architecture)

**Sources:**
- [NestJS-tRPC Context](https://www.nestjs-trpc.io/docs/context)
- [NestJS-tRPC Middlewares](https://www.nestjs-trpc.io/docs/middlewares)
- [tRPC Error Handling](https://trpc.io/docs/server/error-handling)

---

### Pitfall 4: BullMQ Redis Eviction Destroys Job Queue

**What goes wrong:**
- Single Redis instance used for both caching (report summaries, sessions) AND BullMQ job queue (PDF export, email reminders)
- Redis reaches maxmemory limit
- Default eviction policy (`allkeys-lru`) kicks in -- Redis starts evicting least-recently-used keys
- BullMQ job metadata keys are evicted (job data, delayed job markers, queue state)
- PDF export jobs disappear silently, email reminders never fire
- No error is thrown -- jobs just vanish

**Why it happens:**
- Developer uses one Redis for everything (sensible for small deployment)
- Does not configure `maxmemory-policy` to `noeviction`
- BullMQ docs explicitly warn: "It is very important to configure the maxmemory-policy setting to noeviction"
- Caching fills up Redis, eviction evicts BullMQ keys before cache keys (BullMQ keys are accessed less frequently)

**Consequences:**
- Silent job loss (no errors, no alerts, jobs simply disappear)
- PDF exports never complete
- Email reminders never fire
- Head cannot generate reports, leads never reminded
- Extremely hard to diagnose (no error logs, Redis reports healthy)

**Prevention:**
- Option A (recommended for production): Use TWO separate Redis instances:

```yaml
# docker-compose.yml
services:
  redis-cache:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    ports: ["6380:6379"]

  redis-queue:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction
    ports: ["6381:6379"]
```

- Option B (acceptable for early production): Single Redis with `noeviction` policy, use key-based TTL for cache entries:

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy noeviction
```

- In NestJS, configure separate connections for BullMQ and cache:

```typescript
// app.module.ts
BullModule.forRoot({
  connection: {
    host: process.env.REDIS_QUEUE_HOST,
    port: Number(process.env.REDIS_QUEUE_PORT),
  },
}),
CacheModule.register({
  store: redisStore,
  host: process.env.REDIS_CACHE_HOST,
  port: Number(process.env.REDIS_CACHE_PORT),
}),
```

**Detection:**
- Check Redis maxmemory-policy: `redis-cli CONFIG GET maxmemory-policy`. If NOT `noeviction` on queue Redis = this pitfall
- Monitor: alert if BullMQ queue length drops unexpectedly (jobs disappearing)
- BullMQ health check: compare jobs added vs jobs completed over time

**Phase:** BullMQ integration
**Confidence:** HIGH (BullMQ production guide explicitly states this)

**Sources:**
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ Connections](https://docs.bullmq.io/guide/connections)

---

### Pitfall 5: Prisma Connection Pool Exhaustion (Multiple Instances)

**What goes wrong:**
- NestJS instantiates PrismaClient in a module
- Due to NestJS dependency injection or hot-reload, multiple PrismaClient instances are created
- Each instance opens its own connection pool (default: `num_cpus * 2 + 1` connections)
- 3 NestJS instances * 5 connections each = 15 connections
- With PgBouncer default_pool_size = 20, pool is nearly full
- Under load, "Timed out fetching a new connection from the pool" errors

**Why it happens:**
- PrismaClient not registered as a true NestJS singleton
- `new PrismaClient()` called in multiple modules instead of injecting shared instance
- Hot-reload in development creates new instances without closing old ones
- Connection limit not tuned for deployment topology

**Consequences:**
- Intermittent timeouts on database queries
- Application hangs under moderate load
- "Timed out fetching a new connection from the pool" in logs
- Users see spinning loaders, think app is broken

**Prevention:**
- Create PrismaService as a global NestJS singleton:

```typescript
// prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: process.env.DATABASE_URL } },
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- Register as global module:

```typescript
// prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- Set explicit connection_limit in DATABASE_URL:

```env
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/customreport?connection_limit=5"
```

- Formula: `connection_limit = PgBouncer_default_pool_size / number_of_app_instances`

**Detection:**
- Monitor: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'customreport'`
- If connection count exceeds PgBouncer pool size, pool exhaustion is happening
- Check NestJS logs for "Timed out fetching a new connection from the pool"

**Phase:** Prisma repository implementation
**Confidence:** HIGH (Prisma docs + GitHub issues confirm this is the #1 production issue)

**Sources:**
- [Prisma Connection Pool](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

---

## Moderate Pitfalls

### Pitfall 6: Docker Build Fails on workspace:* Dependencies

**What goes wrong:**
- `package.json` in `apps/api` references `"@customreport/shared": "workspace:*"`
- `docker build` from `apps/api/` context cannot resolve workspace protocol
- pnpm install fails inside Docker with `ERR_PNPM_NO_MATCHING_VERSION_INSIDE_WORKSPACE`
- Build is completely broken

**Why it happens:**
- Docker build context is set to individual app directory instead of monorepo root
- pnpm workspace protocol (`workspace:*`) requires the workspace root (pnpm-workspace.yaml + pnpm-lock.yaml) to resolve
- Developer copies only `apps/api/` into Docker, missing the workspace context

**Consequences:**
- Cannot build Docker images at all
- No containerized deployment
- Blocks the entire infrastructure phase

**Prevention:**
- Use `turbo prune` to create a minimal Docker-compatible workspace:

```dockerfile
# Dockerfile (at monorepo root)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Stage 1: Prune workspace for the target app
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @customreport/api --docker

# Stage 2: Install dependencies
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Stage 3: Build
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@customreport/api

# Stage 4: Production
FROM base AS runner
WORKDIR /app
COPY --from=installer /app/apps/api/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/node_modules ./apps/api/node_modules
```

- ALWAYS set Docker build context to monorepo root (not app directory)
- ALWAYS include `pnpm-lock.yaml` and `pnpm-workspace.yaml` in build context
- Use `--frozen-lockfile` to prevent pnpm from modifying the lockfile

**Detection:**
- `docker build .` from monorepo root should succeed
- If build fails with workspace resolution errors, build context is wrong

**Phase:** Docker Compose setup
**Confidence:** HIGH (Turborepo docs + pnpm Docker guide confirm this pattern)

**Sources:**
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker)
- [pnpm Working with Docker](https://pnpm.io/docker)

---

### Pitfall 7: Prisma Client Not Generated in Docker Build

**What goes wrong:**
- Docker build installs dependencies with `pnpm install`
- Prisma Client is NOT generated (requires explicit `prisma generate`)
- Application starts, first database query fails with `@prisma/client did not initialize yet`
- Runtime crash in production

**Why it happens:**
- `prisma generate` runs as a `postinstall` hook in development
- In Docker multi-stage builds, the postinstall hook may not find the schema.prisma at the expected path
- `turbo prune` may reorganize directories, breaking the relative path from node_modules to prisma/schema.prisma
- pnpm `--frozen-lockfile` skips lifecycle scripts in some configurations

**Consequences:**
- Application crashes on first database access
- Docker image builds "successfully" but is non-functional
- Discovered only at container startup (late in pipeline)

**Prevention:**
- Add explicit `prisma generate` step in Dockerfile AFTER copying schema:

```dockerfile
# In installer stage, after pnpm install:
COPY --from=pruner /app/out/full/ .
RUN pnpm exec prisma generate
RUN pnpm turbo build --filter=@customreport/api
```

- Verify in CI: `docker run --rm api-image node -e "require('@prisma/client')"`
- Add health check that exercises a database query on startup

**Detection:**
- Container logs show `@prisma/client did not initialize yet` or `PrismaClientInitializationError`
- Health check endpoint returns 503 on startup

**Phase:** Docker Compose setup
**Confidence:** HIGH (common issue documented in Prisma GitHub issues)

---

### Pitfall 8: SAML Certificate PEM Format Breaks in Docker Environment Variables

**What goes wrong:**
- Keycloak IdP certificate is a multi-line PEM:
  ```
  -----BEGIN CERTIFICATE-----
  MIICmzCCAYMCBgF...
  -----END CERTIFICATE-----
  ```
- Developer puts it in Docker Compose `.env` file or `environment:` block
- Newlines are stripped or escaped incorrectly
- `@node-saml/passport-saml` receives malformed certificate
- SAML assertion validation fails with `Invalid signature` or `Certificate not valid`
- SSO login completely broken

**Why it happens:**
- Docker Compose `environment:` does not preserve multi-line strings
- `.env` files treat `\n` literally (not as newline) in some configurations
- Developer does not test SAML with the production certificate format
- Works with `AUTH_DEV_MODE=true` (cert is ignored), fails in production

**Consequences:**
- SSO login fails for ALL users in production
- No fallback auth mechanism
- Deployment rollback required
- Debugging is hard (error messages from SAML libraries are cryptic)

**Prevention:**
- Strip PEM headers/footers and store as single-line base64 in env var:

```env
# .env
KEYCLOAK_SAML_CERT="MIICmzCCAYMCBgF...entire cert on one line..."
```

- In SAML strategy, passport-saml accepts cert without headers
- Alternative: mount certificate as a Docker volume:

```yaml
services:
  api:
    volumes:
      - ./certs/keycloak-idp.pem:/app/certs/idp.pem:ro
    environment:
      KEYCLOAK_SAML_CERT_PATH: /app/certs/idp.pem
```

- Read cert from file in strategy:

```typescript
const idpCert = process.env.KEYCLOAK_SAML_CERT_PATH
  ? fs.readFileSync(process.env.KEYCLOAK_SAML_CERT_PATH, 'utf-8')
  : process.env.KEYCLOAK_SAML_CERT;
```

- ALWAYS test SAML login flow with production certificate in Docker Compose before deploying

**Detection:**
- SAML login returns `Invalid signature` or `Error parsing SAML response`
- Works in dev mode, fails in Docker environment
- Certificate value in container: `docker exec api printenv KEYCLOAK_SAML_CERT | wc -l` -- if > 1 line, format is wrong

**Phase:** SAML auth integration
**Confidence:** HIGH (passport-saml docs confirm cert format requirements)

**Sources:**
- [passport-saml Configuration](https://www.passportjs.org/packages/passport-saml/)
- [node-saml/passport-saml GitHub](https://github.com/node-saml/passport-saml)

---

### Pitfall 9: SAML Callback URL Mismatch Between SSR and API

**What goes wrong:**
- Next.js runs on `localhost:3000` (or `app.company.com`)
- NestJS API runs on `localhost:3001` (or `api.company.com`)
- SAML Assertion Consumer Service (ACS) URL configured in Keycloak points to API: `https://api.company.com/auth/saml/callback`
- User initiates login from Next.js frontend, redirected to Keycloak
- Keycloak POSTs SAML assertion to API callback URL
- API sets JWT cookie, but cookie domain is `api.company.com`
- Next.js on `app.company.com` cannot read the cookie -- user appears not logged in
- SSR pages have no auth context -- hydration mismatch when client-side reads cookie from a different path

**Why it happens:**
- Frontend and API are on different origins (different ports or subdomains)
- Cookie domain/path not configured for cross-origin
- No clear architecture for "who handles SAML callback and where does the session live"
- Works in development (both on localhost), breaks in production (different domains)

**Consequences:**
- Login appears to work (Keycloak returns success) but user is never authenticated in the frontend
- SSR shows "logged out" state, client hydrates with "logged in" state -- hydration error
- Session cookies not shared between frontend and API
- Infinite redirect loops (frontend redirects to login, Keycloak says "already logged in", redirects back)

**Prevention:**
- Architecture decision: SAML callback on API, redirect to frontend with short-lived auth code:

```
User -> Next.js /login -> redirect to Keycloak
Keycloak -> POST NestJS /auth/saml/callback
NestJS validates SAML -> issues JWT -> redirects to Next.js /auth/complete?token=<jwt>
Next.js /auth/complete -> stores JWT in httpOnly cookie (same domain) -> redirects to dashboard
```

- OR: use same domain with path-based routing (nginx/reverse proxy):
  - `app.company.com/` -> Next.js
  - `app.company.com/api/` -> NestJS
  - Cookie set on `app.company.com` is readable by both

- Set cookie with correct domain and SameSite attributes:

```typescript
res.cookie('auth_token', jwt, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  domain: '.company.com', // leading dot = all subdomains
  path: '/',
  maxAge: 3600 * 1000,
});
```

**Detection:**
- After SAML login, check browser cookies -- is the auth cookie present on the frontend domain?
- SSR request: does `getServerSideProps` / server component have access to the auth cookie?
- If cookie exists on API domain but not frontend domain = this pitfall

**Phase:** SAML auth integration
**Confidence:** HIGH (fundamental web architecture, well-documented cookie domain behavior)

---

### Pitfall 10: Frontend localStorage-to-API Migration Causes Hydration Mismatch

**What goes wrong:**
- Current v1 frontend reads report data from localStorage
- v2 migration replaces localStorage with tRPC API calls
- During migration, some components still read localStorage (fallback)
- Server renders with no data (SSR has no localStorage)
- Client hydrates with localStorage data
- React throws `Hydration failed because the initial UI does not match what was rendered on the server`
- White screen or broken UI on first load

**Why it happens:**
- Incremental migration: some components migrated to API, others still use localStorage
- Next.js SSR renders on server where `window.localStorage` does not exist
- `typeof window !== 'undefined'` checks lead to different render output between server and client
- React 19 strict mode makes hydration errors more visible

**Consequences:**
- White screen or React error boundary on first load
- Flickering UI (server renders empty, client fills in data)
- Broken user experience during migration period
- Hard to debug (error only appears on first load, disappears on navigation)

**Prevention:**
- Cut over atomically: when migrating a component, replace ALL data sources at once (no hybrid localStorage + API)
- Use React `useSyncExternalStore` for any remaining localStorage access:

```typescript
function useLocalStorageValue(key: string) {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('storage', callback);
      return () => window.removeEventListener('storage', callback);
    },
    () => localStorage.getItem(key),
    () => null, // server snapshot -- always null
  );
}
```

- For API data, use tRPC + React Query with `initialData` from SSR:

```typescript
// In server component or getServerSideProps:
const report = await trpc.getActiveSection.fetch();
// Pass to client component as prop, used as initialData
// No hydration mismatch because server and client start with same data
```

- Delete localStorage data after successful API migration to prevent stale reads

**Detection:**
- Open browser console: `Hydration failed` error on first load
- Compare server HTML source vs client-rendered DOM -- if different, this pitfall
- Test: disable JavaScript, check if server-rendered page shows correct data

**Phase:** Frontend API migration
**Confidence:** HIGH (Next.js docs + React 19 hydration changes confirm)

**Sources:**
- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error)
- [FluentReact localStorage Fix](https://www.fluentreact.com/blog/nextjs-localstorage-hydration-errors-fix)

---

### Pitfall 11: BullMQ Job Serialization Loses Date Objects

**What goes wrong:**
- Job payload contains `Date` objects: `{ deadline: new Date('2026-04-15'), ... }`
- BullMQ serializes job data to JSON for Redis storage
- `JSON.stringify(new Date())` produces a string: `"2026-04-15T00:00:00.000Z"`
- Worker reads job data, `deadline` is now a string, not a Date
- Code like `if (deadline < new Date())` does string comparison instead of date comparison
- Deadline check produces wrong results, reminders fire at wrong time

**Why it happens:**
- JSON.stringify/parse does not preserve Date objects (converts to ISO string)
- Developer passes domain objects directly as job data without serialization strategy
- Unit tests work because they don't go through Redis (mock queue)
- Integration tests work because Date string comparison happens to work for "equal" dates

**Consequences:**
- Reminder emails sent at wrong time
- PDF export jobs processed with wrong timestamps
- Carry-over logic fires at wrong reporting period boundary
- Subtle: tests pass, production behavior is wrong

**Prevention:**
- ALWAYS serialize dates to ISO strings explicitly in job payload
- ALWAYS parse dates back in worker with `new Date()` or Zod:

```typescript
// Producer: explicit serialization
const jobData = {
  reportId: report.id,
  deadline: report.deadline.toISOString(), // explicitly string
};
await this.emailQueue.add('send-reminder', jobData);

// Worker: explicit deserialization with Zod
const reminderJobSchema = z.object({
  reportId: z.string().uuid(),
  deadline: z.coerce.date(), // parses ISO string back to Date
});

@Process('send-reminder')
async handleReminder(job: Job) {
  const data = reminderJobSchema.parse(job.data);
  // data.deadline is now a proper Date object
}
```

- Never pass raw domain objects as BullMQ job data

**Detection:**
- In worker, check `typeof job.data.deadline === 'string'` -- if true, serialization issue exists
- Integration test: add job with Date, read from Redis directly, verify it round-trips correctly

**Phase:** BullMQ integration
**Confidence:** HIGH (fundamental JSON serialization behavior)

---

## Minor Pitfalls

### Pitfall 12: Prisma Transaction Timeout on Report Assembly

**What goes wrong:**
- Report assembly queries 6 sections, each with items, risks, decisions, priorities
- All wrapped in `prisma.$transaction()` for consistency
- Default Prisma interactive transaction timeout: 5 seconds
- Under load, transaction times out before completing
- Report assembly fails intermittently

**Prevention:**
- Set explicit timeout on heavy transactions:

```typescript
const report = await prisma.$transaction(
  async (tx) => {
    const sections = await tx.reportSection.findMany({ where: { reportId }, include: { ... } });
    // ... assemble report
    return assembledReport;
  },
  { timeout: 15000 }, // 15 seconds for heavy read
);
```

- For read-only assembly, consider using non-transactional query (single `findUnique` with nested `include`)
- Monitor transaction durations with Prisma query logging

**Phase:** Prisma repository implementation
**Confidence:** MEDIUM (depends on data volume and query complexity)

---

### Pitfall 13: Docker Compose Port Conflicts with Host Services

**What goes wrong:**
- Docker Compose exposes PostgreSQL on `5432:5432`
- Developer already has PostgreSQL running on host port 5432
- `docker compose up` fails with `port is already allocated`
- Or worse: app connects to HOST PostgreSQL instead of Docker PostgreSQL

**Prevention:**
- Use non-standard host ports in docker-compose.yml:

```yaml
services:
  postgres:
    ports: ["5433:5432"]  # Host 5433, Container 5432
  redis:
    ports: ["6380:6379"]  # Host 6380, Container 6379
  pgbouncer:
    ports: ["6433:6432"]  # Host 6433, Container 6432
```

- Use Docker network names in app config (not localhost):

```env
# App connects via Docker network (inside container)
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/customreport
# Developer tools connect via host port
# pgAdmin: localhost:5433
```

**Phase:** Docker Compose setup
**Confidence:** HIGH (common development environment issue)

---

### Pitfall 14: turbo prune Drops injectWorkspacePackages Setting

**What goes wrong:**
- Monorepo uses `injectWorkspacePackages: true` in `.npmrc` or pnpm settings
- `turbo prune --docker` generates output with modified `pnpm-lock.yaml`
- The `settings.injectWorkspacePackages` option is removed from generated lockfile
- `pnpm install --frozen-lockfile` fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

**Prevention:**
- Avoid `injectWorkspacePackages` if possible (use default `workspace:*` protocol)
- If required: patch the pruned lockfile in Dockerfile before install
- Track [Turborepo issue #10584](https://github.com/vercel/turborepo/issues/10584) for fix
- Alternative: use `pnpm deploy` instead of `turbo prune` for production images

**Phase:** Docker Compose setup
**Confidence:** MEDIUM (known open issue, may be fixed by build time)

**Sources:**
- [Turborepo issue #10584](https://github.com/vercel/turborepo/issues/10584)

---

### Pitfall 15: BullMQ Worker Not Started in Docker Compose

**What goes wrong:**
- Developer adds jobs to queue (PDF export, email reminders)
- Jobs sit in Redis indefinitely because no worker is processing them
- No error is thrown -- BullMQ silently queues jobs
- User clicks "Export PDF", sees "Processing..." forever

**Prevention:**
- BullMQ workers must run in the same NestJS process OR as a separate Docker service
- For CustomReport scale (6 users): run workers in the main API process:

```typescript
// pdf-export.processor.ts
@Processor('pdf-export')
export class PdfExportProcessor {
  @Process()
  async handleExport(job: Job<PdfExportJobData>) {
    // ... generate PDF
  }
}
```

- Add health check endpoint that verifies queue is processing:

```typescript
@Get('health/queues')
async queueHealth() {
  const waiting = await this.pdfQueue.getWaitingCount();
  const active = await this.pdfQueue.getActiveCount();
  return { pdf: { waiting, active } };
}
```

- Docker Compose healthcheck:

```yaml
api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health/queues"]
    interval: 30s
```

**Phase:** BullMQ integration
**Confidence:** HIGH (most common BullMQ deployment mistake)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|---|---|---|---|
| **Docker Compose** | Port conflicts with host services (#13) | Use non-standard host ports, Docker networking | Low |
| **Docker Compose** | workspace:* fails in Docker (#6) | Use turbo prune, build from monorepo root | Critical |
| **Docker Compose** | Prisma Client not generated (#7) | Explicit `prisma generate` in Dockerfile | High |
| **Prisma Setup** | Migration through PgBouncer (#2) | directUrl in schema.prisma | Critical |
| **Prisma Setup** | Connection pool exhaustion (#5) | Singleton PrismaService, explicit connection_limit | High |
| **Prisma Setup** | Transaction timeout on assembly (#12) | Explicit timeout, consider non-transactional read | Medium |
| **PgBouncer** | Prepared statement errors (#1) | PgBouncer 1.22+ with max_prepared_statements | Critical |
| **NestJS + tRPC** | Guards bypassed on tRPC routes (#3) | Auth as tRPC middleware, not NestJS guards | Critical |
| **SAML Auth** | Certificate PEM format in Docker (#8) | Single-line cert or volume mount | High |
| **SAML Auth** | Callback URL domain mismatch (#9) | Same-domain reverse proxy or token redirect flow | High |
| **BullMQ** | Redis eviction kills jobs (#4) | noeviction policy or separate Redis instances | Critical |
| **BullMQ** | Job Date serialization (#11) | Explicit ISO string serialization + Zod parsing | Medium |
| **BullMQ** | Worker not started (#15) | In-process worker + health check endpoint | High |
| **Frontend Migration** | Hydration mismatch (#10) | Atomic cutover, useSyncExternalStore for localStorage | High |
| **turbo prune** | Lockfile config mismatch (#14) | Avoid injectWorkspacePackages, track issue | Low |

---

## Sources

- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer) -- HIGH confidence
- [Prisma Connection Pool](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool) -- HIGH confidence
- [Prisma Database Connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections) -- HIGH confidence
- [PgBouncer 1.21 Prepared Statements](https://pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode) -- HIGH confidence
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production) -- HIGH confidence
- [BullMQ Connections](https://docs.bullmq.io/guide/connections) -- HIGH confidence
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker) -- HIGH confidence
- [pnpm Working with Docker](https://pnpm.io/docker) -- HIGH confidence
- [tRPC Error Handling](https://trpc.io/docs/server/error-handling) -- HIGH confidence
- [NestJS-tRPC Context](https://www.nestjs-trpc.io/docs/context) -- MEDIUM confidence (community package)
- [NestJS-tRPC Middlewares](https://www.nestjs-trpc.io/docs/middlewares) -- MEDIUM confidence (community package)
- [passport-saml Configuration](https://www.passportjs.org/packages/passport-saml/) -- HIGH confidence
- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error) -- HIGH confidence
- [Turborepo issue #10584](https://github.com/vercel/turborepo/issues/10584) -- turbo prune lockfile bug -- MEDIUM confidence

---

*Last updated: 2026-04-10 (v2.0 infrastructure integration research)*
