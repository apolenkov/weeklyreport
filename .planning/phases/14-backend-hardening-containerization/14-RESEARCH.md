# Phase 14: Backend Hardening & Containerization - Research

**Researched:** 2026-04-13
**Domain:** Integration testing (Vitest + real PostgreSQL), BullMQ worker testing, tRPC auth middleware testing, Docker multi-stage builds, GitHub Actions CI/CD
**Confidence:** HIGH

## Summary

Phase 14 is primarily a **testing and CI/CD hardening** phase, not a feature phase. The project already has substantial infrastructure in place: 8 integration test files that run against real PostgreSQL via the `prisma-test-helper.ts` utility, 2 BullMQ processors (pdf-export and email-reminder), multi-stage Dockerfiles for both api and web, a docker-compose.yml with PostgreSQL/Redis/migrate/api/web services, and a GitHub Actions CI pipeline with lint+typecheck+unit-test and E2E jobs.

The work splits into three domains: (1) verifying and hardening the existing 8 integration tests so they reliably pass against real PostgreSQL in CI, (2) adding unit tests for BullMQ processors and tRPC auth middleware which currently have zero test coverage, and (3) optimizing Docker image sizes and adding a production-specific compose file with health checks. The CI pipeline already exists and runs on every push; the main gap is ensuring integration tests are included in the CI run.

**Primary recommendation:** Focus on filling the three test gaps (BullMQ processors, tRPC middleware, integration test CI inclusion) and optimizing the existing Docker setup -- do not rebuild infrastructure that already works.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked**: NestJS 11 + Prisma 7 + tRPC 11 + BullMQ 5 + Vitest 4 + Playwright + TypeScript strict
- **PgBouncer DESCOPED**: REQUIREMENTS.md explicitly lists PgBouncer as out of scope. ROADMAP success criterion #5 mentions PgBouncer but this is stale text -- the actual docker-compose.yml does NOT include PgBouncer and the Phase 7 VERIFICATION confirmed DOCK-06 was descoped per stakeholder feedback
- **Docker Compose is the deploy target** (not Kubernetes)
- **Quality gates**: TypeScript strict, ESLint + Prettier, Husky + lint-staged, Vitest (unit), Playwright (E2E)
- **RTK prefix**: All bash commands must use `rtk` prefix

## Existing Infrastructure Audit

### What Already Exists (DO NOT REBUILD)

| Component                       | Location                                                         | Status                                                                                      |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 8 integration test files        | `apps/api/src/modules/*/\*.integration.test.ts`                  | Written, run via `pnpm --filter=@customreport/api test:integration`                         |
| `prisma-test-helper.ts`         | `apps/api/src/test-utils/`                                       | Working: createTestPrisma, cleanDatabase, seedTestData, disconnectTestPrisma                |
| Prisma 7 PrismaPg adapter       | test helper uses `@prisma/adapter-pg` + `pg.Pool`                | Matches production PrismaService pattern                                                    |
| `Dockerfile.api`                | Root, 4-stage: base/pruner/builder/runner                        | Uses Playwright base image for PDF (mcr.microsoft.com/playwright:v1.59.0-noble)             |
| `Dockerfile.web`                | Root, 4-stage: base/pruner/builder/runner                        | Uses node:20-alpine with Next.js standalone output                                          |
| `docker-compose.yml`            | Root                                                             | PostgreSQL 15-alpine, Redis 7-alpine, migrate init, api, web with health checks             |
| `docker-compose.dev.yml`        | Root                                                             | Dev override with builder target and bind mounts                                            |
| `ci.yml`                        | `.github/workflows/`                                             | 3 jobs: quality (lint+typecheck+unit), e2e (Playwright + PG + Redis services), docker-build |
| BullMQ pdf-export processor     | `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`     | Uses raw Worker (not @Processor due to NestJS 11 DI bug)                                    |
| BullMQ email-reminder processor | `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` | Same raw Worker pattern                                                                     |
| Health endpoints                | `/health/live` (liveness), `/health/ready` (readiness)           | Terminus-based: PrismaHealth, RedisHealth, MemoryHealth                                     |
| tRPC auth middleware            | `apps/api/src/infrastructure/trpc/trpc.middleware.ts`            | `protectedProcedure` (isAuthed) + `headProcedure` (isHead)                                  |

### What Is MISSING (Phase 14 scope)

| Gap                            | Success Criterion | Current State                                                                                                                        |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| BullMQ processor tests         | SC-2              | Zero test files for pdf-export.processor.ts and email-reminder.processor.ts                                                          |
| tRPC auth middleware tests     | SC-3              | Zero test files for trpc.middleware.ts (protectedProcedure, headProcedure)                                                           |
| Integration tests in CI        | SC-1              | `test:integration` script exists but ci.yml only runs `pnpm turbo test` (unit tests) -- integration tests are NOT in the CI pipeline |
| docker-compose.prod.yml        | SC-5              | Only docker-compose.yml exists (dual-use dev/prod); no dedicated prod compose                                                        |
| Docker image size optimization | SC-4              | API image uses full Playwright base (1.4GB+); web image is already small (alpine)                                                    |

## Architecture Patterns

### Recommended Test Structure

```
apps/api/src/
  infrastructure/
    bullmq/
      pdf-export.processor.ts           # existing
      pdf-export.processor.test.ts      # NEW: mock Playwright + PdfExportService
      email-reminder.processor.ts       # existing
      email-reminder.processor.test.ts  # NEW: mock EmailService + RemindersService
    trpc/
      trpc.middleware.ts                # existing
      trpc.middleware.test.ts           # NEW: test protectedProcedure + headProcedure
```

### Pattern 1: BullMQ Processor Unit Testing

**What:** Test the processJob logic without starting a real Redis Worker or launching Playwright.

**When to use:** For processors that depend on heavy external services (browser, SMTP).

**Approach:** The processors use raw `Worker` class with a callback. Extract the processJob method's logic by:

1. Constructing the processor class with mocked dependencies (PdfExportService, EmailService)
2. Calling the private `processJob` method indirectly by invoking `onModuleInit()` to set up the worker, then testing the callback

However, a cleaner approach: since the processors are `@Injectable()` classes with constructor-injected deps, test them by:

1. Creating mock deps
2. Instantiating the processor directly
3. Making `processJob` accessible for testing (either by changing visibility to `protected` or by testing through the worker callback)

**Recommended pattern for pdf-export.processor.test.ts:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// Mock playwright BEFORE importing the processor
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Then test processJob by creating a minimal mock Job object
```

### Pattern 2: tRPC Middleware Unit Testing

**What:** Test that `protectedProcedure` blocks unauthenticated requests and `headProcedure` blocks non-head roles.

**Approach:** The tRPC middleware uses `initTRPC.context<TrpcContext>()`. Test by creating a caller with a specific context:

```typescript
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";

// Create a minimal router using the middleware, then test via createCallerFactory
const testRouter = router({
  protectedRoute: protectedProcedure.query(() => "ok"),
  headRoute: headProcedure.query(() => "ok"),
});

// Test with null session -> UNAUTHORIZED
// Test with lead session on headRoute -> FORBIDDEN
// Test with head session on headRoute -> ok
```

### Pattern 3: Docker Image Size Optimization

**What:** The API Dockerfile uses `mcr.microsoft.com/playwright:v1.59.0-noble` as the runner base (~1.4GB+). This exceeds the 200MB target by a wide margin.

**Key insight:** The Playwright image is needed because the PDF export processor launches a Chromium browser. Two options:

1. **Accept the size** -- PDF generation requires a full browser; there is no way around the ~1GB Chromium dependency
2. **Separate the PDF worker** into its own container that uses the Playwright image, while the API container uses node:20-alpine (~180MB)

**Recommendation:** Option 2 is ideal for long-term but adds architectural complexity. For Phase 14, document the reason the API image exceeds 200MB (Chromium dependency) and optimize what can be optimized (prune devDependencies, use `--prod` install, clean build artifacts). The 200MB target in the success criteria is unrealistic for the API image given Chromium; the web image should easily meet it.

### Anti-Patterns to Avoid

- **Do not use @Processor/@WorkerHost**: The codebase comment explicitly notes a DiscoveryService DI bug in @nestjs/bullmq 11 with NestJS 11. Keep the raw Worker pattern.
- **Do not add PgBouncer**: Descoped per stakeholder feedback, unnecessary for 10 users/week.
- **Do not mock Prisma in integration tests**: The prisma-test-helper.ts connects to real PostgreSQL. Integration tests are specifically for testing against real DB.
- **Do not duplicate existing CI jobs**: The ci.yml already runs lint+typecheck+unit+E2E+docker-build. Add integration tests as a new step or job, don't restructure what works.

## Don't Hand-Roll

| Problem                   | Don't Build                        | Use Instead                                                | Why                                                                        |
| ------------------------- | ---------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Test database setup       | Custom Docker container management | Existing `prisma-test-helper.ts` with `createTestPrisma()` | Already connects via PrismaPg adapter, matches production pattern          |
| tRPC procedure testing    | HTTP request mocking               | `createCallerFactory` from @trpc/server                    | Official pattern for testing procedures without HTTP transport             |
| BullMQ job object mocking | Custom Job class                   | `{ data: {...} } as Job<T>` minimal cast                   | Processors only read `job.data`; no need for full Job mock                 |
| Docker monorepo pruning   | Manual COPY with .dockerignore     | `turbo prune --docker`                                     | Already in Dockerfiles; handles workspace:\* protocol and dependency trees |
| CI service containers     | Docker-in-Docker                   | GitHub Actions `services:` block                           | Already used for PostgreSQL and Redis in E2E job                           |

## Common Pitfalls

### Pitfall 1: Integration Tests Need Serial Execution

**What goes wrong:** Integration tests share a single PostgreSQL database. Parallel execution causes foreign key conflicts and non-deterministic failures.
**Why it happens:** Vitest runs files in parallel by default; the existing `test:integration` script already uses `--fileParallelism=false` but CI must also pass this flag.
**How to avoid:** Always run integration tests with `--fileParallelism=false` flag. The existing script already does this correctly.
**Warning signs:** Random test failures that pass when re-run individually.

### Pitfall 2: Playwright Mock Must Be Hoisted

**What goes wrong:** `vi.mock('playwright')` must appear before the import of pdf-export.processor.ts; otherwise the real `chromium.launch` is bound at import time.
**Why it happens:** ESM module hoisting binds imports before test setup code runs.
**How to avoid:** Use `vi.mock()` at the top level of the test file (Vitest hoists vi.mock calls automatically).
**Warning signs:** Test tries to actually launch a browser.

### Pitfall 3: DATABASE_URL Must Be Set for Integration Tests in CI

**What goes wrong:** Integration tests fail with connection error because `DATABASE_URL` is not configured in the CI job that runs them.
**Why it happens:** Currently, integration tests are NOT part of the CI pipeline. Adding them requires the same PostgreSQL service container as the E2E job.
**How to avoid:** Either add integration tests to the existing E2E job (which already has PostgreSQL services) or create a separate CI job with its own PostgreSQL service.
**Warning signs:** "ECONNREFUSED" or "connection to server failed" in CI logs.

### Pitfall 4: API Docker Image Size vs Chromium

**What goes wrong:** The Playwright base image is ~1.4GB; the 200MB success criterion cannot be met.
**Why it happens:** PDF generation requires a full Chromium browser installation.
**How to avoid:** Acknowledge this in the plan. The web image can meet 200MB (alpine-based). The API image needs Chromium for PDF generation -- this is an architectural constraint, not an optimization failure.
**Warning signs:** Spending time trying to shrink Chromium below ~800MB.

### Pitfall 5: Raw Worker Redis Connection in Tests

**What goes wrong:** Instantiating PdfExportProcessor/EmailReminderProcessor calls `onModuleInit()` which creates a real BullMQ Worker that tries to connect to Redis.
**Why it happens:** The raw Worker is created in `onModuleInit()` with hard-coded Redis connection.
**How to avoid:** In unit tests, do NOT call `onModuleInit()`. Instead, test the processor logic by extracting or directly invoking `processJob`. Alternatively, mock the Worker constructor.
**Warning signs:** Tests hang waiting for Redis connection or fail with ECONNREFUSED.

## Docker Image Analysis

### Current State

**API Image (Dockerfile.api):**

- Base: `node:20-alpine` for build stages
- Runner: `mcr.microsoft.com/playwright:v1.59.0-noble` (Ubuntu-based, ~1.4GB with Chromium)
- Copies entire `/app` from builder (all monorepo files including devDependencies)
- **Optimization opportunities:** Run `pnpm prune --prod` before copying to runner; only copy needed workspaces

**Web Image (Dockerfile.web):**

- Base: `node:20-alpine` for all stages
- Runner: `node:20-alpine` (~180MB base)
- Uses Next.js standalone output (minimal file set)
- **Already optimized** -- should be well under 200MB

### Optimization Strategy

1. **Web image**: Already uses standalone output + alpine. Expected ~150-180MB. No changes needed.
2. **API image**: The Playwright base image is the dominant cost. Realistic optimizations:
   - Add `pnpm prune --prod` after build to strip devDependencies
   - Only COPY the specific workspace dirs needed at runtime (apps/api/dist, node_modules, prisma)
   - Use a `.dockerignore` to exclude test files, docs, source maps
   - **Result:** Still ~1.2GB+ due to Chromium. Document this as architectural limitation.

### docker-compose.prod.yml Pattern

The existing docker-compose.yml is already production-oriented (builds from Dockerfiles, uses health checks, has volume mounts). The prod variant should:

- Remove bind mounts (no source volumes)
- Add restart policies (`restart: unless-stopped`)
- Add resource limits (memory, CPU)
- Ensure all services have health checks (web currently lacks one)
- Add logging driver configuration

## CI Pipeline Analysis

### Current ci.yml Structure

```
quality job:        lint -> typecheck -> unit tests
e2e job:            (needs quality) PostgreSQL + Redis services -> migrations -> seed -> Playwright
docker-build job:   (needs quality) docker compose build
```

### Gap: Integration Tests Missing from CI

The `test:integration` script runs integration tests against real PostgreSQL but is NOT invoked in CI. Two options:

**Option A (recommended): Add integration test step to the `e2e` job**

- The e2e job already has PostgreSQL + Redis services
- Add `pnpm --filter=@customreport/api test:integration` as a step before E2E tests
- Pros: No additional job, reuses existing services, faster total CI time
- Cons: Conflates integration and E2E concerns

**Option B: Separate `integration` job**

- New job with its own PostgreSQL service (lighter than E2E -- no Playwright, no Next.js build)
- Pros: Cleaner separation, faster feedback (integration tests are fast)
- Cons: Extra CI minutes, duplicated PostgreSQL service definition

**Recommendation:** Option A for simplicity. Integration tests run in <30 seconds and reuse the already-provisioned PostgreSQL.

## Code Examples

### BullMQ Processor Test Pattern

```typescript
// pdf-export.processor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// Mock heavy dependencies
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { chromium } from "playwright";
import { PdfExportProcessor } from "./pdf-export.processor";
import type { PdfExportService } from "../../modules/pdf-export/pdf-export.service";

describe("PdfExportProcessor", () => {
  const mockPdfExportService = {
    markExportCompleted: vi.fn(),
  } as unknown as PdfExportService;

  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content")),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as never);
  });

  it("generates PDF and marks job completed", async () => {
    // Test processJob logic directly...
  });
});
```

### tRPC Middleware Test Pattern

```typescript
// trpc.middleware.test.ts
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, headProcedure } from "./trpc.middleware";

const testRouter = router({
  protectedRoute: protectedProcedure.query(() => "authenticated"),
  headRoute: headProcedure.query(() => "head-only"),
});

describe("tRPC auth middleware", () => {
  it("protectedProcedure rejects null session", async () => {
    const caller = testRouter.createCaller({ session: null });
    await expect(caller.protectedRoute()).rejects.toThrow(TRPCError);
  });

  it("protectedProcedure allows any authenticated user", async () => {
    const caller = testRouter.createCaller({
      session: { userId: "...", role: "lead" /* ... */ },
    });
    await expect(caller.protectedRoute()).resolves.toBe("authenticated");
  });

  it("headProcedure rejects non-head roles", async () => {
    const caller = testRouter.createCaller({
      session: { userId: "...", role: "lead" /* ... */ },
    });
    await expect(caller.headRoute()).rejects.toThrow(TRPCError);
  });
});
```

## State of the Art

| Old Approach                | Current Approach                    | When Changed                  | Impact                                                        |
| --------------------------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| @Processor + WorkerHost     | Raw Worker class                    | NestJS 11 / @nestjs/bullmq 11 | Must continue using raw Worker due to DiscoveryService DI bug |
| Prisma 6 test client        | Prisma 7 with PrismaPg adapter      | Jan 2026                      | Test helper already uses the correct pattern                  |
| docker-compose v1 syntax    | docker compose v2 (no hyphen)       | 2023+                         | Already using v2 syntax in ci.yml                             |
| Separate Dockerfile per app | turbo prune --docker in multi-stage | Turborepo 2.x                 | Already implemented correctly                                 |

## Environment Availability

| Dependency          | Required By           | Available        | Version   | Fallback |
| ------------------- | --------------------- | ---------------- | --------- | -------- |
| Node.js             | Runtime               | Yes              | v25.9.0   | --       |
| Docker              | Container builds      | Yes              | 29.2.1    | --       |
| Docker Compose      | Service orchestration | Yes              | 5.0.2     | --       |
| pnpm                | Package management    | Yes              | 10.11.0   | --       |
| PostgreSQL (Docker) | Integration tests     | Yes (via Docker) | 15-alpine | --       |
| Redis (Docker)      | BullMQ in CI          | Yes (via Docker) | 7-alpine  | --       |

**Missing dependencies:** None. All tools available locally and in GitHub Actions.

## PgBouncer Clarification

ROADMAP success criterion #5 states: "docker-compose.prod.yml starts full stack (PostgreSQL, Redis, PgBouncer, API, Web) with health checks."

**This is stale text.** PgBouncer was descoped in Phase 7:

- REQUIREMENTS.md: "PgBouncer -- unnecessary for this scale (descoped in v2.0)"
- Phase 7 VERIFICATION: "DOCK-06 | DESCOPED | Intentionally removed per stakeholder feedback"
- Actual docker-compose.yml: No PgBouncer service exists

**The planner should interpret SC-5 as:** docker-compose.prod.yml starts PostgreSQL, Redis, API, Web (without PgBouncer).

## Open Questions

1. **API image 200MB target**
   - What we know: Chromium/Playwright base image is ~1.4GB; PDF generation requires a browser
   - What's unclear: Whether the 200MB target was written before or after Playwright was chosen for PDF
   - Recommendation: Accept that API image will be ~1.2-1.4GB due to Chromium. Web image meets 200MB. Document this tradeoff. If strict 200MB is required, the PDF worker must be split into a separate container.

2. **Integration test assertion count toward "183 unit tests"**
   - What we know: The "183 unit tests" figure likely includes both service tests and integration tests run via `pnpm turbo test`
   - What's unclear: Whether integration tests are counted in that 183 or are additional
   - Recommendation: After adding new tests, run full suite and report total counts.

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection: Dockerfile.api, Dockerfile.web, docker-compose.yml, ci.yml, all _.test.ts and_.integration.test.ts files, processor files, middleware files
- apps/api/package.json: test and test:integration scripts confirmed
- Phase 7 VERIFICATION.md: PgBouncer descope confirmed

### Secondary (MEDIUM confidence)

- CLAUDE.md technology stack documentation: version numbers verified against package.json

## Metadata

**Confidence breakdown:**

- Existing infrastructure: HIGH -- verified by direct codebase reading
- Test patterns: HIGH -- BullMQ mock and tRPC caller patterns are standard Vitest approaches
- Docker optimization: HIGH -- Playwright image size is a known constraint
- CI pipeline changes: HIGH -- ci.yml structure fully understood, changes are additive

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack, no major version changes expected)
