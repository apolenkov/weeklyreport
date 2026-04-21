# Phase 16: Backend Hardening - Research

**Researched:** 2026-04-21
**Domain:** NestJS API hardening, BullMQ queue infrastructure, Prisma schema migration, Docker containerization, theme wiring
**Confidence:** HIGH

## Summary

Phase 16 addresses six requirements spanning backend schema alignment, BullMQ re-enablement, regression testing, MSW/web test fixes, and ThemeProvider wiring. The codebase is in a mixed state: domain-layer services and Zod schemas are complete, but Prisma DB schema is out of sync with the running application code, BullMQ module is not imported in AppModule (queues never connect), and Docker Compose has a port mismatch that breaks healthchecks.

The most critical finding is that **D-14 is incorrect** -- the CONTEXT states "no new migration expected since init already has all columns" but the init migration SQL creates `ReminderRule` with `name/cronExpression/enabled` columns while `schema.prisma` now declares `kind/fireAt/timezone/status/version/reportId?`. A Prisma migration IS required. Additionally, `PdfExportJob` has Prisma columns (`filePath`, `requestedBy`, `error`) that don't match the Zod domain model (`artifactUrl`, `checksum`, `templateVersion`, `requestedAt`, `completedAt`) -- the repository layer papers over this with mapping functions, but `checksum` is always lost (hardcoded to `null`).

Web tests currently pass (29/29), confirming D-17 that BE-05 is pre-satisfied. API has 250 passing and 19 failing tests -- all 19 failures are integration tests that need a running PostgreSQL (DB auth error, not code defects). Contract/unit tests pass cleanly.

**Primary recommendation:** Start with Prisma migration (BE-01) since it unblocks integration tests and validates schema alignment, then BullMQ import (BE-02), then regression tests (BE-03) which depend on both. ThemeProvider (BE-06) and MSW/web fixes (BE-04, BE-05) can run in parallel.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Full BullMQ re-enablement: add BullMQModule import to AppModule + Redis/queue health indicator on /health endpoint + Bull Board UI at /admin/queues
- D-02: Bull Board protected by JWT + admin role guard. Single admin role for now; role granularity deferred
- D-03: Graceful shutdown for BullMQ workers -- register onApplicationShutdown to close workers cleanly
- D-04: Processors already registered as providers -- just need DI connection via BullMQModule import
- D-05: Full Docker Compose review: verify all containers, add resource limits, fix port mismatch, audit .dockerignore, document K8s migration path
- D-06: Keep K8s-ready structure: health checks, proper user isolation, separate images, externalized env config
- D-07: Turborepo/monorepo build system: verify turbo prune works correctly with BullMQ deps
- D-08: All P0+P1 scenarios from REGRESSION-TEST-SCENARIOS.md as API integration tests (may be more or fewer than 81)
- D-09: Extend existing 15 contract/integration test files by module -- no separate regression files
- D-10: In-memory mocks for test data (continue established Prisma repository mock pattern)
- D-11: System preference detection as default -- detect OS dark/light mode, allow user override
- D-12: Cookie-based persistence via next-themes (no FOUC on SSR, works with RSC)
- D-13: Wire ThemeProvider in layout.tsx + add sun/moon toggle in nav-user dropdown
- D-14: Verify schema alignment between Prisma and Zod -- RESEARCH FINDING: migration IS required (see Architecture Patterns)
- D-15: Fix reportId mismatch: make Zod optional to match Prisma String? -- safer, no data loss
- D-16: Verify seed data survives after schema adjustments
- D-17: Web tests currently pass (29/29). If 24 pre-existing failures already fixed, mark BE-05 as pre-satisfied with verification

### Claude's Discretion
- Exact Bull Board route and middleware setup
- Specific health check indicators (liveness vs readiness probes)
- Docker resource limit values (memory, CPU)
- .dockerignore audit specifics
- K8s migration documentation format
- MSW handler update details
- Regression scenario selection from P0/P1 priority list
- Theme toggle icon design and placement details

### Deferred Ideas (OUT OF SCOPE)
- Bull Board role granularity (separate viewer/admin roles) -- future phase
- Real PostgreSQL testcontainers for true integration testing -- future consideration
- K8s manifests/Helm charts -- future deployment phase
- Dark mode token fine-tuning -- Phase 17 UI redesign scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BE-01 | Prisma migration aligns ReminderRule schema (kind/fireAt/timezone/status/version) with Zod contract | Migration IS required -- init SQL has name/cronExpression/enabled. Additionally PdfExportJob Prisma columns don't match Zod. Zod reportId must become optional. See "CRITICAL: Schema Drift Analysis" below. |
| BE-02 | BullMQ re-enabled in AppModule (PDF export + email reminders functional) | BullMQModule exists but is not imported in AppModule. PdfExportModule and RemindersModule create services without queue injection. Must update module factories to inject BullMQ queues. Bull Board already mounted in main.ts. |
| BE-03 | All P0+P1 regression scenarios pass as API integration tests | 523 P0 + 359 P1 = 882 total scenarios. Existing 250 tests cover significant portion. Extend existing 15 contract test files per D-09. Use in-memory mocks per D-10. |
| BE-04 | MSW handlers updated to match current tRPC contracts (superjson serialization) | MSW handlers in apps/web/src/test/msw-handlers.ts already use superjson. Audit needed to verify all procedure shapes match current routers. Currently all 29 web tests pass. |
| BE-05 | Pre-existing 24 jsdom test failures in web package fixed | CONFIRMED: Web tests pass 29/29 with 0 failures. BE-05 is pre-satisfied. Requires verification test run only. |
| BE-06 | ThemeProvider wired into layout.tsx (next-themes installed, not connected) | next-themes v0.4.6 is in packages/ui/package.json. Sonner already uses useTheme(). Layout.tsx needs ThemeProvider wrapper. Nav-user dropdown needs toggle button. Dark mode tokens exist in globals.css. |
</phase_requirements>

## Architecture Patterns

### CRITICAL: Schema Drift Analysis

The Prisma schema (`schema.prisma`) has diverged from the init migration SQL. This is the root issue for BE-01:

**ReminderRule -- MIGRATION REQUIRED:**

| Init Migration SQL | Current schema.prisma | Zod Schema |
|---|---|---|
| `name TEXT NOT NULL` | `kind ReminderRuleKind` (enum: deadline, follow_up) | `kind: z.enum(['deadline', 'follow_up'])` |
| `cronExpression TEXT NOT NULL` | `fireAt DateTime` | `fireAt: z.coerce.date()` |
| `enabled BOOLEAN DEFAULT true` | `status ReminderRuleStatus` (enum: active, paused) | `status: z.enum(['active', 'paused'])` |
| (not present) | `timezone String @default("Europe/Moscow")` | `timezone: z.string().min(1)` |
| (not present) | `version Int @default(1)` | `version: z.number().int().min(1)` |
| `reportId TEXT?` | `reportId String?` | `reportId: z.string().uuid()` -- REQUIRED in Zod, optional in Prisma |

**PdfExportJob -- MAPPING LAYER HANDLES IT (no migration needed immediately):**

| Prisma Column | Maps To (Zod) | How |
|---|---|---|
| `id` | `jobId` | Direct rename in `toExportJob()` |
| `filePath` | `artifactUrl` | Direct rename in `toExportJob()` |
| `requestedBy` | (dropped) | Hardcoded 'system' on write |
| `createdAt` | `requestedAt` | Direct map |
| `updatedAt` | `completedAt` | Conditional: only when status=completed |
| (not stored) | `checksum` | Always `null` -- data loss |
| (not stored) | `templateVersion` | Hardcoded `'phase-2-pdf-v1'` |

The PdfExportJob has a working but lossy mapping layer. This is acceptable for now since checksum verification is not critical for the PDF display flow. The migration can be deferred.

### Migration Strategy for ReminderRule

The migration must:
1. Create the `ReminderRuleKind` and `ReminderRuleStatus` enums
2. Add new columns (`kind`, `fireAt`, `timezone`, `status`, `version`) with defaults
3. Convert existing data: `name` -> `kind`, `enabled` -> `status`
4. Drop old columns (`name`, `cronExpression`, `enabled`)

Use `prisma migrate dev --create-only` then hand-edit the SQL to include UPDATE statements before DROP, per Critical Pitfall v4-P3.

### BullMQ Re-enablement Pattern

Current state:
- `BullMQModule` exists at `apps/api/src/infrastructure/bullmq/bullmq.module.ts` -- registers Redis connection and two queues
- `AppModule` does NOT import `BullMQModule` -- queues never connect
- `PdfExportProcessor` and `EmailReminderProcessor` registered as providers in `AppModule` -- they create raw Workers with direct Redis connection (bypassing @nestjs/bullmq DI to avoid DiscoveryService bug)
- `PdfExportModule` creates `PdfExportService` without queue: `new PdfExportService(repo)` -- queue param is `null`
- `RemindersModule` creates `RemindersService` without queue: `new RemindersService(repo)` -- queue param is `null`
- Both services have `if (this.pdfQueue)` / `if (this.emailQueue)` guards -- they silently skip enqueuing when queue is null

Required changes:
1. Add `BullMQModule` to `AppModule.imports[]`
2. Update `PdfExportModule` to import `BullMQModule` and inject `getQueueToken('pdf-export')` into the factory -- NestJS DI is module-scoped, so the queue token must be available within `PdfExportModule`'s scope, not just in AppModule
3. Update `RemindersModule` to import `BullMQModule` and inject `getQueueToken('email-reminder')` -- same module-scope rule applies
4. Verify processors already handle graceful shutdown via `onModuleDestroy` (they do -- both call `this.worker?.close()`)
5. Add BullMQ health indicator to the readiness endpoint

**CRITICAL NestJS DI note:** `AppModule` importing `BullMQModule` does NOT make queue tokens available inside `PdfExportModule` or `RemindersModule`. NestJS DI is module-scoped. Each module that needs to inject a queue token must either: (a) import `BullMQModule` directly, or (b) `BullMQModule` must be decorated with `@Global()`. Option (a) is cleaner since `BullMQModule` already exports `BullModule`.

### BullMQ Queue Health Check

The health module (`apps/api/src/infrastructure/health/`) already has `PrismaHealthIndicator` and `RedisHealthIndicator`. Add a `BullMQHealthIndicator` that pings the Redis connection used by BullMQ. The readiness endpoint at `/health/ready` already includes Redis check -- BullMQ uses the same Redis, so a queue-specific check (e.g., `Queue.getJobCounts()`) would confirm queue connectivity.

### Docker Port Mismatch (Three-Way)

| File | PORT env | EXPOSE/port | Healthcheck |
|---|---|---|---|
| `env.schema.ts` | default: 3001 | -- | -- |
| `Dockerfile.api` | -- | EXPOSE 3001 | -- |
| `docker-compose.yml` | NOT SET (defaults 3001) | 3002:3002 | hits :3002/health/live |
| `docker-compose.dev.yml` | PORT=3002 | 3002:3002 | -- |
| `docker-compose.prod.yml` | NOT SET (defaults 3001) | 3001:3001 | hits :3001/health/live |

**`docker-compose.yml` is the broken file.** Fix: change ports to `3001:3001` and healthcheck to `localhost:3001`, aligning with `env.schema.ts` default (3001), `Dockerfile.api` EXPOSE (3001), and `docker-compose.prod.yml` (3001). The dev compose explicitly overrides to 3002 which is fine.

### ThemeProvider Wiring Pattern

Current state:
- `next-themes` v0.4.6 is a dependency of `packages/ui` (peer dep on next + react)
- `Toaster` in `sonner.tsx` already calls `useTheme()` from next-themes -- this works because ThemeProvider is not required for the hook to return a default ("system")
- `layout.tsx` has `<html>` with `suppressHydrationWarning` already set (needed by next-themes)
- Design tokens in `globals.css` are currently dark-mode only (no light-mode @theme block)
- Dark mode is the only defined palette -- light mode tokens must be added in Phase 17

ThemeProvider wiring per D-11 (system detection as default):
```tsx
// apps/web/src/app/layout.tsx
import { ThemeProvider } from 'next-themes';

<html lang="ru" className={...} suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* existing providers and children */}
    </ThemeProvider>
  </body>
</html>
```

**Note on light mode:** With `defaultTheme="system"` per D-11, users with OS light mode will see the dark palette applied to light mode since only dark tokens are defined. This is acceptable -- D-11 is a locked decision (system detection), and dark mode token fine-tuning is explicitly deferred to Phase 17. The ThemeProvider infrastructure will be correct; the visual palette just needs light tokens added later.

Cookie persistence: `next-themes` v0.4.x handles cookie storage automatically with `storageKey` prop (defaults to `"theme"`). No manual cookie handling needed.

Theme toggle in nav-user dropdown:
```tsx
// apps/web/src/components/navigation/nav-user.tsx
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

// Inside dropdown menu, before logout:
const { theme, setTheme } = useTheme();
<DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? <Sun /> : <Moon />}
  <span>Toggle theme</span>
</DropdownMenuItem>
```

### Existing Test Infrastructure

**API tests (269 total):**
- 250 pass (contract + unit tests using in-memory mocks)
- 19 fail (all integration tests requiring PostgreSQL -- `P1000 AuthenticationFailed`)
- Test files: 30 files across 8 modules + infrastructure
- Integration tests use real Prisma against PostgreSQL via `prisma-test-helper.ts`
- Contract tests use `createRepository()` pattern with in-memory state

**Web tests (29 total):**
- 29/29 pass -- all green
- MSW handlers in `apps/web/src/test/msw-handlers.ts` with superjson serialization
- Setup: `vitest.setup.ts` starts MSW server before all tests
- Tests cover: admin panel, assembled report, submission dashboard, navigation, report section form, archive, published report, auth session

**Integration test DB issue:** The `prisma-test-helper.ts` connects to `postgresql://postgres:postgres@localhost:5432/customreport_test` by default. The 19 integration test failures are DB connectivity (wrong credentials), not code bugs. The admin integration test has an additional problem: it creates ReminderRule with `name/cronExpression/enabled` fields that don't exist in the current Prisma schema.

### Established Contract Test Pattern

From `report-sections.contract.test.ts` (the canonical example):
1. Define constant UUIDs for fixtures
2. Create a typed `baseSection` object matching the Zod read model
3. Implement `createRepository()` returning an in-memory mock of the repository interface
4. Group tests by service method: happy paths, error paths, edge cases
5. Assert both return values and domain error codes

For BE-03 regression tests, extend existing `*.contract.test.ts` files with additional test cases from the P0/P1 regression scenarios.

### Regression Test Scope (BE-03)

The regression file has 1050+ scenarios total:
- **P0 (Critical):** 523 scenarios
- **P1 (High):** 359 scenarios
- **P0+P1 total:** 882 scenarios

However, the existing 250 passing tests already cover a significant portion of these scenarios (auth, report sections, review, publication, PDF export, admin, reminders, carry-over, archive). The work is to:
1. Map P0/P1 scenarios to existing test files by module
2. Identify which scenarios are already covered by existing tests
3. Write additional test cases for uncovered scenarios
4. All new tests follow D-09 (extend existing files) and D-10 (in-memory mocks)

The original requirement says "81 regression scenarios" which likely refers to a subset selection from the 882 P0+P1 pool. D-08 clarifies "may be more or fewer than 81."

### Zod reportId Nullable Cascade

When `adminReminderRuleSchema.reportId` changes from required to nullable (D-15), the following repository mappings must also change:
- `RemindersPrismaRepository.toRuleDomain()` currently uses `rule.reportId ?? '00000000-...'` fallback UUID -- should pass `null` instead
- `AdminPrismaRepository.getSnapshot()` also uses the same fallback pattern -- should pass `null`
- `toExecutionDomain()` in `RemindersPrismaRepository` derives `reportId` from `execution.rule.reportId` with the same fallback -- should pass `null`

These are not separate tasks but must be included in the BE-01 Zod schema fix scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence | Cookie/localStorage manager | `next-themes` ThemeProvider | Handles SSR hydration, FOUC prevention, system detection |
| Queue health check | Manual Redis ping | `@nestjs/terminus` + BullMQ queue.getJobCounts() | Consistent with existing health module pattern |
| Queue monitoring UI | Custom dashboard | `@bull-board/express` + `@bull-board/api` | Already implemented in `bull-board.module.ts` |
| Migration data conversion | Manual SQL scripts | `prisma migrate dev --create-only` + hand-edit | Ensures Prisma knows about the migration while allowing custom UPDATE statements |
| BullMQ graceful shutdown | process.on('SIGTERM') | `onModuleDestroy` lifecycle hook | Already implemented in both processors |

## Common Pitfalls

### Pitfall 1: Prisma Migration Data Loss (Critical Pitfall v4-P3)
**What goes wrong:** Running `prisma migrate dev` generates SQL that drops old columns before converting data
**Why it happens:** Prisma diff generates clean ALTER TABLE DROP/ADD without data migration
**How to avoid:** Use `--create-only`, hand-edit SQL to include UPDATE statements that convert old data to new columns before dropping old columns
**Warning signs:** Seed data missing after migration; empty `kind`/`fireAt` columns

### Pitfall 2: BullMQ DiscoveryService Bug
**What goes wrong:** Using `@Processor` decorator with `@nestjs/bullmq` 11 + NestJS 11 causes DI errors
**Why it happens:** Known compatibility issue between @nestjs/bullmq DiscoveryService and NestJS 11
**How to avoid:** Use raw `Worker` instances (already done in both processors). Import `BullMQModule` for queue registration only, not for processor discovery.
**Warning signs:** `DiscoveryService` errors at startup

### Pitfall 3: Docker Port Mismatch Breaks Healthcheck
**What goes wrong:** API container starts on port 3001 but healthcheck pings 3002
**Why it happens:** `docker-compose.yml` maps ports to 3002 but never sets PORT=3002 in environment (default is 3001)
**How to avoid:** Ensure PORT env var matches the EXPOSE and healthcheck port in every compose file
**Warning signs:** Container marked unhealthy, dependent services don't start

### Pitfall 4: ThemeProvider FOUC (Flash of Unstyled Content)
**What goes wrong:** Page flashes light theme before switching to user's dark preference
**Why it happens:** Server renders with no theme class, client hydrates and adds it
**How to avoid:** Use `attribute="class"` + `disableTransitionOnChange` on ThemeProvider, ensure `suppressHydrationWarning` on `<html>` tag (already present)
**Warning signs:** Brief white flash on page load when dark mode is selected

### Pitfall 5: Admin Integration Test Uses Old Schema
**What goes wrong:** Admin integration test creates ReminderRule with `name`, `cronExpression`, `enabled` fields that no longer exist in Prisma schema
**Why it happens:** Test was written for the init schema, not updated when schema.prisma changed
**How to avoid:** After migration, update admin integration test to use `kind`, `fireAt`, `timezone`, `status`, `version` fields
**Warning signs:** TypeScript compilation errors in test file after schema change

### Pitfall 6: NestJS Module-Scoped DI for Queue Tokens
**What goes wrong:** `PdfExportModule` tries to inject `getQueueToken('pdf-export')` but gets "Nest can't resolve dependencies of PdfExportService"
**Why it happens:** NestJS DI is module-scoped. Importing `BullMQModule` in `AppModule` does NOT make queue tokens visible inside `PdfExportModule`
**How to avoid:** Each module that injects a queue token must import `BullMQModule` directly (or `BullMQModule` must use `@Global()`)
**Warning signs:** Runtime DI error on application startup -- "Nest can't resolve dependencies"

### Pitfall 7: BullMQ Queue Not Injected in Service Modules
**What goes wrong:** Services created without queue parameter, silently skip job enqueueing
**Why it happens:** PdfExportModule and RemindersModule useFactory creates service with `new Service(repo)` -- no queue arg
**How to avoid:** After importing BullMQModule, update module factories to inject queue tokens and pass them to service constructors
**Warning signs:** Jobs appear to succeed (no errors) but PDF never generates, emails never send

## Code Examples

### BullMQ Module Import in AppModule
```typescript
// apps/api/src/app.module.ts
import { BullMQModule } from './infrastructure/bullmq/bullmq.module';

@Module({
  imports: [
    PrismaModule,
    BullMQModule,  // <-- Add this
    HealthModule,
    MetricsModule,
    // ... other modules
  ],
  providers: [PdfExportProcessor, EmailReminderProcessor, EmailService],
})
export class AppModule implements NestModule { ... }
```

### Queue Injection in PdfExportModule (with BullMQModule import)
```typescript
// apps/api/src/modules/pdf-export/pdf-export.module.ts
import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { BullMQModule } from '../../infrastructure/bullmq/bullmq.module';

@Module({
  imports: [BullMQModule],  // <-- Required for module-scoped DI
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (repo: PdfExportPrismaRepository, queue: Queue) =>
        new PdfExportService(repo, undefined, queue),
      inject: [PdfExportPrismaRepository, getQueueToken('pdf-export')],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}
```

### Queue Injection in RemindersModule (same pattern)
```typescript
// apps/api/src/modules/reminders/reminders.module.ts
import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { BullMQModule } from '../../infrastructure/bullmq/bullmq.module';

@Module({
  imports: [BullMQModule],  // <-- Required for module-scoped DI
  providers: [
    RemindersPrismaRepository,
    {
      provide: RemindersService,
      useFactory: (repo: RemindersPrismaRepository, queue: Queue) =>
        new RemindersService(repo, undefined, queue),
      inject: [RemindersPrismaRepository, getQueueToken('email-reminder')],
    },
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
```

### Prisma Migration SQL (hand-edited template)
```sql
-- Step 1: Create new enums
CREATE TYPE "ReminderRuleKind" AS ENUM ('deadline', 'follow_up');
CREATE TYPE "ReminderRuleStatus" AS ENUM ('active', 'paused');

-- Step 2: Add new columns with defaults
ALTER TABLE "ReminderRule" ADD COLUMN "kind" "ReminderRuleKind" NOT NULL DEFAULT 'deadline';
ALTER TABLE "ReminderRule" ADD COLUMN "fireAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReminderRule" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow';
ALTER TABLE "ReminderRule" ADD COLUMN "status" "ReminderRuleStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "ReminderRule" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Step 3: Convert existing data
UPDATE "ReminderRule" SET
  "kind" = CASE WHEN "name" ILIKE '%follow%' THEN 'follow_up' ELSE 'deadline' END,
  "status" = CASE WHEN "enabled" = true THEN 'active' ELSE 'paused' END;

-- Step 4: Drop old columns
ALTER TABLE "ReminderRule" DROP COLUMN "name";
ALTER TABLE "ReminderRule" DROP COLUMN "cronExpression";
ALTER TABLE "ReminderRule" DROP COLUMN "enabled";

-- Step 5: Remove defaults from non-defaulted columns
ALTER TABLE "ReminderRule" ALTER COLUMN "fireAt" DROP DEFAULT;
```

### Zod reportId Fix (D-15) + Repository Cascade
```typescript
// packages/shared/src/schemas/report.ts
export const adminReminderRuleSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid().nullable(),  // <-- Change from required to nullable
  kind: adminReminderRuleKindSchema,
  fireAt: z.coerce.date(),
  timezone: z.string().min(1),
  status: adminReminderRuleStatusSchema,
  version: z.number().int().min(1),
});

// Then update repository mappings to pass null instead of fake UUID:
// RemindersPrismaRepository.toRuleDomain():   reportId: rule.reportId  (remove ?? fallback)
// AdminPrismaRepository.getSnapshot():         reportId: rule.reportId  (remove ?? fallback)
// toExecutionDomain():                         reportId: execution.rule.reportId  (remove ?? fallback)
```

### ThemeProvider in layout.tsx
```tsx
// apps/web/src/app/layout.tsx
import { ThemeProvider } from 'next-themes';

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <TRPCProvider>{children}</TRPCProvider>
          </TooltipProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## Docker/Containerization Review Findings

### Port Consistency Matrix

| Compose File | API PORT env | Host:Container ports | Healthcheck URL | Status |
|---|---|---|---|---|
| `docker-compose.yml` | NOT SET (3001) | 3002:3002 | localhost:3002 | BROKEN |
| `docker-compose.dev.yml` | PORT=3002 | 3002:3002 | (none) | OK |
| `docker-compose.prod.yml` | NOT SET (3001) | 3001:3001 | localhost:3001 | OK |

**Fix:** Change `docker-compose.yml` ports to `3001:3001` and healthcheck to `localhost:3001`. This aligns with env.schema.ts default (3001), Dockerfile.api EXPOSE (3001), and docker-compose.prod.yml (3001).

### .dockerignore Audit

Current `.dockerignore`:
```
node_modules, .next, dist, .git, .gitignore, *.md, .planning, .playwright-mcp,
.remember, .rtk, .sisyphus, test-results, coverage, **/*.test.ts, **/*.spec.ts,
**/*.integration.test.ts, .env, .env.local
```

Missing entries to add:
- `.claude/` -- agent configuration
- `.graphifyignore` -- project tool config
- `*.png` -- screenshots in project root
- `.planning/` already excluded -- good

### Resource Limits (from docker-compose.prod.yml -- already set)
- PostgreSQL: 512M
- Redis: 256M
- API: 2G (needs headroom for Playwright/Chromium PDF generation)
- Web: 512M

### K8s Readiness Assessment

Already K8s-ready patterns:
- Separate liveness (`/health/live`) and readiness (`/health/ready`) endpoints
- Non-root user in both Dockerfiles (`nodejs:1001`)
- Externalized env vars (DATABASE_URL, REDIS_HOST, etc.)
- Stateless API (JWT, no server sessions)
- Named volumes for persistent data (pgdata, redisdata, pdfdata)

K8s migration path items to document:
- Convert Docker Compose services to Kubernetes Deployments + Services
- Volume claims for pgdata, redisdata, pdfdata
- ConfigMap for non-secret env vars, Secret for DB_PASSWORD/JWT_SECRET
- Ingress for web (port 3000) and API (port 3001)
- HPA based on CPU/memory for API pods

## Bull Board Status

Bull Board is **already fully implemented** in `apps/api/src/infrastructure/bullmq/bull-board.module.ts`:
- Mounted at `/admin/queues` in `main.ts`
- Protected by JWT auth with `head` role check (D-02 says "admin role guard" -- `head` IS the admin role in this system, there is no separate admin role)
- Creates Queue instances directly for monitoring (bypasses @nestjs/bullmq DI)
- D-02 is already satisfied -- just needs BullMQ module import so queues are actually connected

## Open Questions

1. **Regression test count finalization**
   - What we know: 882 P0+P1 scenarios exist, 250 tests already pass
   - What's unclear: Exact count of new tests needed (depends on coverage gap analysis)
   - Recommendation: Planner should allocate a coverage audit task before writing tests, then scope regression work to uncovered P0+P1 scenarios

2. **Integration test DB connectivity**
   - What we know: 19 integration tests fail with `P1000 AuthenticationFailed` (wrong Postgres credentials)
   - What's unclear: Whether Docker DB is expected to be running for these tests, or if they should be converted
   - Recommendation: These are true integration tests that need a running DB. D-10 says use in-memory mocks, so new regression tests should use contract test pattern, not integration pattern. Existing integration test failures are separate from BE-03 scope.

## Sources

### Primary (HIGH confidence)
- `apps/api/src/app.module.ts` -- confirmed BullMQModule missing from imports
- `prisma/migrations/20260410150628_init/migration.sql` -- confirmed old ReminderRule schema (name/cronExpression/enabled)
- `prisma/schema.prisma` lines 203-225 -- confirmed new ReminderRule schema (kind/fireAt/timezone/status/version)
- `packages/shared/src/schemas/report.ts` lines 198-206 -- confirmed Zod adminReminderRuleSchema with required reportId
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` -- confirmed mapping layer handles PdfExportJob drift
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts` -- confirmed toRuleDomain expects kind/fireAt/timezone/status/version
- `apps/web/src/test/msw-handlers.ts` -- confirmed superjson serialization already in place
- Test run: `pnpm --filter @customreport/web exec vitest run` -- 29/29 pass
- Test run: `pnpm --filter @customreport/api exec vitest run` -- 250 pass, 19 fail (DB auth only)

### Secondary (MEDIUM confidence)
- `next-themes` v0.4.6 docs -- ThemeProvider attribute="class" pattern, cookie persistence
- `@nestjs/bullmq` docs -- getQueueToken() for DI injection, module-scoped resolution
- `@bull-board/express` docs -- ExpressAdapter pattern (confirmed by existing code)

## Metadata

**Confidence breakdown:**
- Prisma schema drift: HIGH -- verified by comparing migration SQL to schema.prisma to Zod schemas
- BullMQ re-enablement: HIGH -- traced full DI chain from module to service to processor
- Docker port mismatch: HIGH -- cross-referenced all compose files and env.schema.ts
- Test infrastructure: HIGH -- ran tests and examined patterns
- ThemeProvider wiring: HIGH -- verified next-themes installed, Sonner already uses useTheme

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable -- no fast-moving dependencies)
