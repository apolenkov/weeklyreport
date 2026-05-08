# Phase 5: Backend Foundation - Research

**Researched:** 2026-04-10
**Domain:** NestJS + Prisma + tRPC integration for monorepo backend
**Confidence:** HIGH

## Summary

Phase 5 transforms 8 domain services with repository interfaces into a working NestJS HTTP API backed by PostgreSQL through Prisma. The codebase is exceptionally well-prepared: every service already accepts a `Repository` interface via constructor injection, Zod schemas are the single source of truth in `packages/shared`, and 51 unit tests use in-memory repository implementations that prove domain logic correctness. The phase adds no new domain logic -- it implements the infrastructure layer beneath the existing domain layer.

The critical path is: (1) complete the Prisma schema with 5 missing models, (2) run the initial migration, (3) fix the seed script for idempotency, (4) implement PrismaService as a global NestJS singleton, (5) implement 8 Prisma repository classes that satisfy existing interfaces, (6) wire NestJS modules with DI, (7) bootstrap NestJS HTTP with tRPC Express middleware, (8) expand the tRPC router from 4 to 16+ procedures, and (9) add integration tests. The dev bypass auth (`AUTH_DEV_MODE=true`) provides a hardcoded session so tRPC endpoints can be tested without SAML (deferred to Phase 6).

**Primary recommendation:** Work database-first (schema + migration + seed), then bottom-up (PrismaService -> repositories -> NestJS modules -> tRPC router -> main.ts bootstrap). Each layer is independently testable before adding the next.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key architectural decisions from research:

- tRPC runs as Express middleware on NestJS (official `@trpc/server/adapters/express`), NOT through NestJS controller layer
- Auth as tRPC middleware (not NestJS guards) -- guards are bypassed on tRPC routes (pitfall #3)
- Dev bypass mode (`AUTH_DEV_MODE=true`) provides hardcoded session for Phase 5 testing
- PrismaModule as global singleton with explicit `connection_limit`
- Prisma `directUrl` for migrations (never through PgBouncer)
- All repositories parse output through Zod schemas before returning

### Reference Implementation

reference-app (forge.example.org/example/platform/reference-app) uses OIDC+JWKS for Keycloak auth. For Phase 5, use dev bypass only. OIDC wiring deferred to Phase 6.

### Claude's Discretion

All implementation choices are at Claude's discretion -- pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)

- OIDC/SAML auth wiring -> Phase 6
- Frontend tRPC client -> Phase 6
- BullMQ job processing -> Phase 7
- Docker Compose -> Phase 7
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                  | Research Support                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB-01   | Prisma schema includes all domain models (add 5 missing: PdfExportJob, ReminderRule, ReminderExecution, CarryOverExecution, CarryOverRecord) | Zod schemas in `packages/shared/src/schemas/report.ts` define exact shapes; Prisma schema at `prisma/schema.prisma` has 10 models, needs 5 more  |
| DB-02   | Initial migration creates all tables in PostgreSQL                                                                                           | `prisma migrate dev` from monorepo root; `prisma.config.ts` reads `DATABASE_URL` from env                                                        |
| DB-03   | Seed script creates baseline data (6 leads, 1 head, 1 viewer, projects, current report period)                                               | Existing `prisma/seed.ts` already creates head + 6 leads + projects + report + sections; needs viewer user added                                 |
| DB-04   | Seed is idempotent (safe to run multiple times)                                                                                              | Seed already uses `upsert` for users/report/sections/statuses/priorities; but `Item.create` is NOT idempotent -- needs fix                       |
| API-01  | NestJS bootstraps HTTP server on configurable port                                                                                           | `main.ts` is empty bootstrap; rewrite with `NestFactory.create(AppModule)` + `app.listen(PORT)`                                                  |
| API-02  | tRPC adapter mounts AppRouter at `/trpc` as Express middleware                                                                               | Use `@trpc/server/adapters/express` createExpressMiddleware on NestJS Express instance                                                           |
| API-03  | tRPC context factory extracts UserSession from JWT cookie                                                                                    | Dev bypass: return hardcoded session when `AUTH_DEV_MODE=true`; real JWT extraction deferred to Phase 6                                          |
| API-04  | All 8 domain services wired via NestJS DI with Prisma repositories                                                                           | 8 NestJS modules, each providing repository implementation + service                                                                             |
| API-05  | Environment configuration validated with Zod on startup                                                                                      | Create `env.schema.ts` with Zod, validate in `main.ts` before NestFactory.create                                                                 |
| API-06  | CORS configured for frontend origin                                                                                                          | `app.enableCors({ origin: process.env.FRONTEND_URL })` in main.ts                                                                                |
| API-07  | Structured error handling maps domain errors to tRPC error codes                                                                             | tRPC onError handler + error mapping from 6 domain error types to TRPCError codes                                                                |
| REPO-01 | ReportSectionsRepository implementation (nested includes: projects, items, risks, decisions, priorities)                                     | HIGH complexity: 6 Prisma models (ReportSection + ProjectStatus + Item + Risk + Decision + Priority); needs deep include + Zod-to-Prisma mapping |
| REPO-02 | ReviewService repository (assemble full report with all sections)                                                                            | LOW: single findMany with joins on ReportSection + User + Project                                                                                |
| REPO-03 | PublicationService repository (publish report, update status)                                                                                | HIGH: deep aggregate -- Report with all nested sections and their children                                                                       |
| REPO-04 | PdfExportRepository implementation (job CRUD)                                                                                                | MEDIUM: requires new PdfExportJob model; simple CRUD                                                                                             |
| REPO-05 | RemindersRepository implementation (rule + execution CRUD with dedupe)                                                                       | MEDIUM: requires new ReminderRule + ReminderExecution models                                                                                     |
| REPO-06 | CarryOverRepository implementation (transactional cross-report copy)                                                                         | HIGH: requires new models + `prisma.$transaction` for atomic multi-table write                                                                   |
| REPO-07 | AdminRepository implementation (users, projects, periods, reminder rules CRUD)                                                               | MEDIUM: snapshot pattern reads 4+ tables, writes individual entities                                                                             |
| REPO-08 | ArchiveRepository implementation (query published reports by date)                                                                           | LOW: filtered query on Report + sections                                                                                                         |
| REPO-09 | All repositories parse output through Zod schemas before returning                                                                           | Already established pattern in service layer; repositories return raw Prisma data, services parse via Zod                                        |
| QA-01   | All existing 51 backend tests still pass with Prisma repositories                                                                            | Tests use in-memory repos via constructor injection; no change needed if service constructors remain identical                                   |
| QA-04   | Integration tests for repository implementations against real PostgreSQL                                                                     | New test files per repository; requires running PostgreSQL (Docker container)                                                                    |

</phase_requirements>

## Standard Stack

### Core (already installed or at monorepo root)

| Library            | Version                       | Purpose                       | Why Standard                                                                    |
| ------------------ | ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `@prisma/client`   | 7.6.0 (verified installed)    | Generated ORM client          | Already at root `package.json`; TypeScript-native, 3x faster than Prisma 6      |
| `prisma`           | 7.6.0 (verified installed)    | CLI for migrations/generate   | Already at root `devDependencies`                                               |
| `@trpc/server`     | ^11.16.0 (verified installed) | tRPC server + Express adapter | Already in `apps/api/package.json`; `@trpc/server/adapters/express` is built-in |
| `@nestjs/common`   | ^11.1.0 (verified installed)  | NestJS core decorators        | Already in `apps/api/package.json`                                              |
| `@nestjs/core`     | ^11.1.0 (verified installed)  | NestJS runtime                | Already in `apps/api/package.json`                                              |
| `reflect-metadata` | ^0.2.2 (verified installed)   | NestJS decorator support      | Already in `apps/api/package.json`                                              |

### New Dependencies (must install for Phase 5)

| Library                    | Version | Purpose                               | Why Standard                                                                                                  |
| -------------------------- | ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@nestjs/platform-express` | ^11.1.0 | NestJS HTTP adapter for Express       | Official NestJS package; required to bootstrap HTTP server and get Express instance for tRPC middleware mount |
| `@nestjs/config`           | ^4.0.0  | Environment variable management       | Official NestJS package; provides `ConfigModule.forRoot()` with Zod validation                                |
| `helmet`                   | ^8.0.0  | Security headers (CSP, HSTS, X-Frame) | Standard Express security middleware; lightweight                                                             |
| `cookie-parser`            | ^1.4.7  | Parse cookies from request            | Required for JWT cookie extraction in tRPC context factory                                                    |

### Dev Dependencies (must install for Phase 5)

| Library                | Version | Purpose                            | Why Standard                                              |
| ---------------------- | ------- | ---------------------------------- | --------------------------------------------------------- |
| `@types/cookie-parser` | ^1.4.8  | TypeScript types for cookie-parser | Required for strict TypeScript                            |
| `@types/express`       | ^5.0.0  | TypeScript types for Express       | Required for tRPC context factory typing (`req: Request`) |

### Alternatives Considered

| Instead of       | Could Use                                   | Tradeoff                                                                                                                                      |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nestjs/config` | raw `process.env` + manual Zod parse        | Config module integrates with NestJS DI; but manual Zod parse is also fine and lighter. Either approach works                                 |
| `cookie-parser`  | manual `cookie` package (already installed) | `cookie-parser` is standard Express middleware; the `cookie` package is already a dependency and used in auth.controller.ts. Could use either |

**Installation:**

```bash
pnpm --filter=@customreport/api add @nestjs/platform-express@^11.1.0 @nestjs/config@^4.0.0 helmet@^8.0.0 cookie-parser@^1.4.7
pnpm --filter=@customreport/api add -D @types/cookie-parser @types/express
```

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
  main.ts                              # NestJS bootstrap (REWRITE)
  app.module.ts                        # Root module (NEW)
  infrastructure/
    prisma/
      prisma.service.ts                # PrismaClient singleton (NEW)
      prisma.module.ts                 # Global module exporting PrismaService (NEW)
    config/
      env.schema.ts                    # Zod schema for environment vars (NEW)
      env.module.ts                    # ConfigModule.forRoot wrapper (NEW)
    trpc/
      trpc.router.ts                   # Unified AppRouter (NEW)
      trpc.context.ts                  # Context factory (NEW)
      trpc.middleware.ts               # Auth + role middleware (NEW)
  modules/
    report-sections/
      report-sections.service.ts       # EXISTS - no change
      report-sections.service.test.ts  # EXISTS - no change
      report-sections.prisma-repository.ts  # NEW
      report-sections.module.ts        # NEW
    review/
      review.service.ts               # EXISTS - no change
      review.prisma-repository.ts      # NEW
      review.module.ts                 # NEW
    publication/
      publication.service.ts           # EXISTS - no change
      publication.prisma-repository.ts  # NEW
      publication.module.ts            # NEW
    pdf-export/
      pdf-export.service.ts           # EXISTS - no change
      pdf-export.prisma-repository.ts  # NEW
      pdf-export.module.ts             # NEW
    admin/
      admin.service.ts                 # EXISTS - no change
      admin.prisma-repository.ts       # NEW
      admin.module.ts                  # NEW
    reminders/
      reminders.service.ts             # EXISTS - no change
      reminders.prisma-repository.ts   # NEW
      reminders.module.ts              # NEW
    carry-over/
      carry-over.service.ts           # EXISTS - no change
      carry-over.prisma-repository.ts  # NEW
      carry-over.module.ts             # NEW
    archive/
      archive.service.ts              # EXISTS - no change
      archive.prisma-repository.ts     # NEW
      archive.module.ts                # NEW
    auth/
      (all files exist - no changes in Phase 5)
  lib/
    logger.ts                          # EXISTS - no change
    logger.test.ts                     # EXISTS - no change
```

### Pattern 1: PrismaService Global Singleton

**What:** Single `PrismaClient` instance managed by NestJS lifecycle, exported globally.
**When to use:** Every module that needs database access.

```typescript
// apps/api/src/infrastructure/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"],
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

```typescript
// apps/api/src/infrastructure/prisma/prisma.module.ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Pattern 2: Repository Implementation with NestJS DI Token

**What:** Concrete Prisma repository registered with a string token matching the service's constructor dependency.
**When to use:** Every domain module.

```typescript
// apps/api/src/modules/report-sections/report-sections.module.ts
import { Module } from "@nestjs/common";
import { ReportSectionsService } from "./report-sections.service";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

@Module({
  providers: [
    ReportSectionsPrismaRepository,
    {
      provide: ReportSectionsService,
      useFactory: (repo: ReportSectionsPrismaRepository) =>
        new ReportSectionsService(repo),
      inject: [ReportSectionsPrismaRepository],
    },
  ],
  exports: [ReportSectionsService],
})
export class ReportSectionsModule {}
```

**Why `useFactory` instead of `@Inject` decorators on the service:** The services are pure classes with no NestJS decorators. They accept repository interfaces via plain constructor parameters. Adding `@Inject` would couple domain services to NestJS. The `useFactory` pattern keeps services framework-agnostic while still wiring through NestJS DI.

### Pattern 3: tRPC Express Middleware on NestJS

**What:** Mount tRPC as Express middleware on the NestJS HTTP adapter.
**When to use:** The single point where tRPC connects to NestJS.

```typescript
// apps/api/src/main.ts (simplified target shape)
import { NestFactory } from "@nestjs/core";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { createAppRouter } from "./infrastructure/trpc/trpc.router";
import { createContext } from "./infrastructure/trpc/trpc.context";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  });

  // Resolve services from NestJS DI to pass to tRPC router
  const reportSectionsService = app.get(ReportSectionsService);
  // ... resolve all 8 services

  const appRouter = createAppRouter({ reportSectionsService /* ... */ });
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContext(app),
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
```

### Pattern 4: Dev Bypass Auth Context

**What:** When `AUTH_DEV_MODE=true`, the tRPC context factory returns a hardcoded session instead of parsing JWT.
**When to use:** Phase 5 development/testing before SAML is wired.

```typescript
// apps/api/src/infrastructure/trpc/trpc.context.ts
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { UserSession } from "@customreport/shared";

const DEV_SESSION: UserSession = {
  userId: "00000000-0000-0000-0000-000000000099",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: "00000000-0000-0000-0000-000000000001",
  activeReportSectionId: null,
};

export function createContext(app: INestApplication) {
  return async ({ req }: CreateExpressContextOptions) => {
    if (process.env.AUTH_DEV_MODE === "true") {
      return { session: DEV_SESSION };
    }

    // Phase 6: extract JWT from cookie, verify, return session
    return { session: null };
  };
}
```

### Pattern 5: Domain Error to TRPCError Mapping

**What:** Map existing domain error classes to tRPC error codes.
**When to use:** In the tRPC router's `onError` handler and inside procedure implementations.

```typescript
import { TRPCError } from "@trpc/server";

function mapDomainError(error: unknown): TRPCError {
  if (error instanceof ReportSectionDomainError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof ReviewAccessError || error instanceof AdminAccessError) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof PublicationAccessError) {
    // Published report immutability is a conflict
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }
  if (
    error instanceof PdfExportDomainError ||
    error instanceof ArchiveDomainError
  ) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }
  if (
    error instanceof ReminderDomainError ||
    error instanceof CarryOverDomainError
  ) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected error",
  });
}
```

### Anti-Patterns to Avoid

- **Dual validation (Zod + class-validator):** Services already validate with Zod. Do NOT add NestJS DTOs with class-validator decorators. tRPC input schemas use Zod directly.
- **`@Inject()` on domain services:** Services are plain TypeScript classes. Use NestJS `useFactory` providers, not `@Inject` decorators that would couple domain code to NestJS.
- **Multiple PrismaClient instances:** Never `new PrismaClient()` outside PrismaService. Always inject the singleton.
- **NestJS guards on tRPC routes:** Guards are bypassed. All auth must be tRPC middleware (locked decision from CONTEXT.md).
- **Generic repository base class:** Prisma generates per-model typed APIs. A generic `BaseRepository<T>` erases this type safety and gains nothing.

## Don't Hand-Roll

| Problem                | Don't Build                            | Use Instead                             | Why                                                                |
| ---------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| Cookie parsing         | Manual `req.headers.cookie` splitting  | `cookie-parser` middleware              | Edge cases (encoding, multiple values, signed cookies)             |
| Security headers       | Manual `res.setHeader` calls           | `helmet` middleware                     | Covers 11 security headers automatically                           |
| Environment validation | Manual `if (!process.env.X)` checks    | Zod schema parse on startup             | Single source of truth, fail-fast, type-safe                       |
| Connection lifecycle   | Manual `prisma.$connect`/`$disconnect` | NestJS `OnModuleInit`/`OnModuleDestroy` | NestJS handles lifecycle; manual calls leak connections on error   |
| tRPC to Express bridge | Custom middleware wrapper              | `@trpc/server/adapters/express`         | Official adapter; handles streaming, batching, error serialization |

## Common Pitfalls

### Pitfall 1: Prisma Include Depth for ReportSections Aggregate

**What goes wrong:** `ReportSectionsPrismaRepository.getSectionById` needs to include 5 nested relations (projectStatuses -> project, items, risks, decisions, priorities). Missing any `include` causes the Zod parse in the service to fail because the schema expects full objects, not relation IDs.

**Why it happens:** Prisma requires explicit `include` for every relation. The domain schema `reportSectionReadModelSchema` expects fully populated objects (e.g., `projects: [{ projectId, projectName, trafficLight }]`), but Prisma returns only scalar fields by default.

**How to avoid:** Define a shared Prisma include object for the report section aggregate:

```typescript
const reportSectionInclude = {
  projectStatuses: { include: { project: true } },
  items: true,
  risks: true,
  decisions: true,
  priorities: true,
  author: true,
} satisfies Prisma.ReportSectionInclude;
```

Then map the Prisma result to the domain shape (Prisma `projectStatuses` with `project` relation becomes domain `projects` array).

**Warning signs:** `ZodError` on service return with "Required" errors for nested fields.

### Pitfall 2: Prisma-to-Zod Shape Mismatch

**What goes wrong:** Prisma model fields use different names than Zod schema fields. For example:

- Prisma `ReportSection.id` -> Zod `reportSectionReadModelSchema.reportSectionId`
- Prisma `ProjectStatus` (join table) -> Zod `projectReadModelSchema` (flat object with `projectName`)
- Prisma `ReportSection.author.name` -> Zod `authorName` (denormalized)

**Why it happens:** Domain model (Zod) is designed for the UI; Prisma model is normalized for the database. They have different shapes by design.

**How to avoid:** Each repository implementation needs a `toDomain()` mapper function that transforms Prisma results into domain shapes. This function is private to the repository file.

**Warning signs:** Zod parse errors mentioning field names that don't exist on the Prisma model.

### Pitfall 3: Seed Script Item.create Is Not Idempotent

**What goes wrong:** The existing seed script uses `prisma.item.create()` (line 94) instead of `upsert`. Running the seed twice creates duplicate items. Other entities (users, report, sections, statuses, priorities) already use `upsert`.

**Why it happens:** Items don't have a natural unique key in the current schema (no `@@unique` constraint on item columns). The seed was written for single-run usage.

**How to avoid:** Either add a deterministic `id` to seeded items and use `upsert`, or delete items for the section before re-creating them in the seed. The simplest approach: generate deterministic UUIDs for seed items and use `upsert` with those IDs.

**Warning signs:** Seed script throws unique constraint violation OR creates duplicate items on re-run.

### Pitfall 4: NestJS Module Not Exporting Service

**What goes wrong:** A NestJS module provides the service internally but does not export it. Another module (or the tRPC router factory) tries to `app.get(ServiceName)` and gets `undefined` or an injection error.

**Why it happens:** NestJS requires explicit `exports: [ServiceName]` in the module decorator. `providers` makes it available within the module; `exports` makes it available to importers.

**How to avoid:** Every domain module must export its service class. The tRPC router resolves services from the NestJS app container via `app.get()`.

**Warning signs:** `Nest could not find ServiceName. Is it part of the current module?`

### Pitfall 5: Transaction Timeout on CarryOver Write

**What goes wrong:** `CarryOverRepository.saveCarryOver` writes to 3+ tables atomically (CarryOverExecution, CarryOverRecord[], ReportSection items/decisions). Default Prisma interactive transaction timeout is 5 seconds. With many carried items, the transaction can timeout.

**Why it happens:** Prisma interactive transactions have a default 5s timeout. CarryOver writes can involve dozens of items/decisions.

**How to avoid:** Set explicit timeout on the transaction:

```typescript
await this.prisma.$transaction(
  async (tx) => {
    // ... multi-table writes
  },
  { timeout: 15000 },
);
```

**Warning signs:** Intermittent `Transaction API error: Transaction already closed` errors.

### Pitfall 6: verbatimModuleSyntax Conflicts with NestJS Decorators

**What goes wrong:** The base `tsconfig.json` has `"verbatimModuleSyntax": true`. NestJS decorator metadata emission (`emitDecoratorMetadata: true`) generates `import` statements that don't use the `type` keyword, which `verbatimModuleSyntax` may flag.

**Why it happens:** `verbatimModuleSyntax` requires explicit `import type` for type-only imports. NestJS decorator metadata emission auto-generates imports for constructor parameter types.

**How to avoid:** The API `tsconfig.json` already sets `"experimentalDecorators": true` and `"emitDecoratorMetadata": true`. If TypeScript errors appear about type-only imports, the API tsconfig may need to override `"verbatimModuleSyntax": false` locally. Check during implementation.

**Warning signs:** TypeScript errors like `This import is never used as a value and must use 'import type'` on `@Injectable()` class constructors.

## Code Examples

### Mapping Prisma ReportSection to Domain ReportSectionReadModel

The highest-complexity mapping in the entire phase. Prisma returns normalized data; the domain expects a denormalized shape.

```typescript
// In report-sections.prisma-repository.ts
import type { ReportSectionReadModel } from "@customreport/shared";
import type {
  ReportSection,
  ProjectStatus,
  Project,
  Item,
  Risk,
  Decision,
  Priority,
  User,
} from "@prisma/client";

type PrismaReportSectionWithRelations = ReportSection & {
  author: User;
  projectStatuses: (ProjectStatus & { project: Project })[];
  items: Item[];
  risks: Risk[];
  decisions: Decision[];
  priorities: Priority[];
};

function toDomain(
  prismaSection: PrismaReportSectionWithRelations,
): ReportSectionReadModel {
  return {
    reportSectionId: prismaSection.id,
    reportId: prismaSection.reportId,
    authorId: prismaSection.authorId,
    authorName: prismaSection.author.name,
    status: prismaSection.status,
    submittedAt: prismaSection.submittedAt,
    projects: prismaSection.projectStatuses.map((ps) => ({
      projectId: ps.projectId,
      projectName: ps.project.name,
      trafficLight: ps.status as "green" | "yellow" | "red" | null,
    })),
    items: prismaSection.items.map((item) => ({
      id: item.id,
      projectId: item.projectId,
      type: item.type as "current" | "next",
      text: item.text,
      tag: item.tag,
      workflowStatus: item.workflowStatus as "done" | "in_progress" | "blocked",
      carriedOver: item.carriedOver,
      completed: item.completed,
    })),
    risks: prismaSection.risks.map((risk) => ({
      id: risk.id,
      projectId: risk.projectId,
      risk: risk.risk,
      impact: risk.impact,
      mitigation: risk.mitigation,
    })),
    decisions: prismaSection.decisions.map((decision) => ({
      id: decision.id,
      text: decision.text,
      owner: decision.owner,
      deadline: decision.deadline,
      impact: decision.impact,
      resolvedAt: decision.resolvedAt,
    })),
    priorities: prismaSection.priorities.map((priority) => ({
      id: priority.id,
      rank: priority.rank,
      text: priority.text,
    })),
  };
}
```

### Saving ReportSection Aggregate (Atomic Upsert)

The `saveSection` method must atomically update the section and its children (items, risks, decisions, priorities, projectStatuses). Strategy: delete children and re-create them within a transaction.

```typescript
async saveSection(section: ReportSectionReadModel): Promise<ReportSectionReadModel> {
  const result = await this.prisma.$transaction(async (tx) => {
    // Delete existing children
    await tx.item.deleteMany({ where: { reportSectionId: section.reportSectionId } });
    await tx.risk.deleteMany({ where: { reportSectionId: section.reportSectionId } });
    await tx.decision.deleteMany({ where: { reportSectionId: section.reportSectionId } });
    await tx.priority.deleteMany({ where: { reportSectionId: section.reportSectionId } });

    // Update section + recreate children
    return tx.reportSection.update({
      where: { id: section.reportSectionId },
      data: {
        status: section.status,
        submittedAt: section.submittedAt,
        projectStatuses: {
          upsert: section.projects.map((p) => ({
            where: { reportSectionId_projectId: { reportSectionId: section.reportSectionId, projectId: p.projectId } },
            update: { status: p.trafficLight ?? undefined },
            create: { projectId: p.projectId, status: p.trafficLight ?? 'green' },
          })),
        },
        items: { create: section.items.map((item) => ({
          id: item.id ?? undefined,
          projectId: item.projectId,
          type: item.type,
          text: item.text,
          tag: item.tag,
          workflowStatus: item.workflowStatus,
          carriedOver: item.carriedOver,
          completed: item.completed ?? null,
        })) },
        risks: { create: section.risks.map((risk) => ({
          id: risk.id ?? undefined,
          projectId: risk.projectId,
          risk: risk.risk,
          impact: risk.impact,
          mitigation: risk.mitigation,
        })) },
        decisions: { create: section.decisions.map((d) => ({
          id: d.id ?? undefined,
          text: d.text,
          owner: d.owner,
          deadline: d.deadline ?? null,
          impact: d.impact,
          resolvedAt: d.resolvedAt ?? null,
        })) },
        priorities: { create: section.priorities.map((p) => ({
          id: p.id ?? undefined,
          rank: p.rank,
          text: p.text,
        })) },
      },
      include: reportSectionInclude,
    });
  }, { timeout: 10000 });

  return toDomain(result);
}
```

### 5 Missing Prisma Models (Zod-to-Prisma Mapping)

```prisma
// Models to ADD to prisma/schema.prisma

enum PdfExportStatus {
  queued
  processing
  completed
  failed
}

enum ReminderRuleKind {
  deadline
  follow_up
}

enum ReminderRuleStatus {
  active
  paused
}

enum ReminderExecutionStatus {
  queued
  sent
  failed
}

enum CarryOverStatus {
  completed
}

model PdfExportJob {
  id               String          @id @default(uuid())
  reportId         String
  status           PdfExportStatus @default(queued)
  requestedAt      DateTime        @default(now())
  completedAt      DateTime?
  checksum         String?
  templateVersion  String
  artifactUrl      String?
  report           Report          @relation(fields: [reportId], references: [id], onDelete: Cascade)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}

model ReminderRule {
  id            String              @id @default(uuid())
  reportId      String
  kind          ReminderRuleKind
  fireAt        DateTime
  timezone      String
  status        ReminderRuleStatus  @default(active)
  version       Int                 @default(1)
  report        Report              @relation(fields: [reportId], references: [id], onDelete: Cascade)
  executions    ReminderExecution[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model ReminderExecution {
  id              String                   @id @default(uuid())
  ruleId          String
  reportId        String
  dedupeKey       String                   @unique
  status          ReminderExecutionStatus  @default(queued)
  scheduledFor    DateTime
  sentAt          DateTime?
  recipientEmail  String
  errorMessage    String?
  rule            ReminderRule             @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  report          Report                   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt
}

model CarryOverExecution {
  id                   String           @id @default(uuid())
  sourceReportId       String
  targetReportId       String
  dedupeKey            String           @unique
  status               CarryOverStatus  @default(completed)
  startedAt            DateTime
  completedAt          DateTime
  carriedItemCount     Int
  carriedDecisionCount Int
  records              CarryOverRecord[]
  sourceReport         Report           @relation("CarryOverSource", fields: [sourceReportId], references: [id], onDelete: Cascade)
  targetReport         Report           @relation("CarryOverTarget", fields: [targetReportId], references: [id], onDelete: Cascade)
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  @@unique([sourceReportId, targetReportId])
}

model CarryOverRecord {
  id                String              @id @default(uuid())
  executionId       String
  sourceReportId    String
  targetReportId    String
  sourceItemId      String?
  targetItemId      String?
  sourceDecisionId  String?
  targetDecisionId  String?
  status            CarryOverStatus     @default(completed)
  carriedAt         DateTime
  execution         CarryOverExecution  @relation(fields: [executionId], references: [id], onDelete: Cascade)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
}
```

**Note:** The `Report` model needs additional reverse relations:

```prisma
// Add to existing Report model:
  pdfExportJobs       PdfExportJob[]
  reminderRules       ReminderRule[]
  reminderExecutions  ReminderExecution[]
  carryOverSources    CarryOverExecution[] @relation("CarryOverSource")
  carryOverTargets    CarryOverExecution[] @relation("CarryOverTarget")
```

### Expanded tRPC AppRouter (16+ procedures)

```typescript
// apps/api/src/infrastructure/trpc/trpc.router.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  draftSaveSchema,
  submitSectionSchema,
  pdfExportRequestSchema,
  adminUserSchema,
  adminProjectSchema,
  reportPeriodSchema,
  adminReminderRuleSchema,
} from "@customreport/shared";

const t = initTRPC.context<Context>().create();

// Services injected at creation time
export function createAppRouter(services: AllServices) {
  return t.router({
    // ReportSections (3 procedures)
    getActiveSection: t.procedure
      .input(z.object({ reportSectionId: z.string().uuid() }))
      .query(({ input }) =>
        services.reportSections.getActiveSection(input.reportSectionId),
      ),
    saveDraft: t.procedure
      .input(draftSaveSchema)
      .mutation(({ input }) => services.reportSections.saveDraft(input)),
    submitSection: t.procedure
      .input(submitSectionSchema)
      .mutation(({ input }) => services.reportSections.submitSection(input)),

    // Review (1 procedure)
    getSubmissionDashboard: t.procedure
      .input(z.object({ activeReportId: z.string().uuid() }))
      .query(({ input }) =>
        services.review.getSubmissionDashboard(input.activeReportId),
      ),

    // Publication (3 procedures)
    getAssembledReport: t.procedure
      .input(z.object({ activeReportId: z.string().uuid() }))
      .query(({ input }) =>
        services.publication.getAssembledReport(input.activeReportId),
      ),
    updateSectionForReview: t.procedure
      .input(
        z.object({ activeReportId: z.string().uuid() }).merge(draftSaveSchema),
      )
      .mutation(({ input }) =>
        services.publication.updateSectionForReview(
          input.activeReportId,
          input,
        ),
      ),
    publishReport: t.procedure
      .input(z.object({ activeReportId: z.string().uuid() }))
      .mutation(({ input, ctx }) =>
        services.publication.publishReport(input.activeReportId, ctx.session!),
      ),

    // PdfExport (2 procedures)
    requestPdfExport: t.procedure
      .input(pdfExportRequestSchema)
      .mutation(({ input }) =>
        services.pdfExport.requestPdfExport(input.reportId),
      ),
    getPdfExportStatus: t.procedure
      .input(z.object({ jobId: z.string().uuid() }))
      .query(({ input }) => services.pdfExport.getPdfExportStatus(input.jobId)),

    // Admin (5 procedures)
    getAdminSnapshot: t.procedure.query(() => services.admin.getSnapshot()),
    upsertUser: t.procedure
      .input(adminUserSchema)
      .mutation(({ input }) => services.admin.upsertUser(input)),
    upsertProject: t.procedure
      .input(adminProjectSchema)
      .mutation(({ input }) => services.admin.upsertProject(input)),
    upsertPeriod: t.procedure
      .input(reportPeriodSchema)
      .mutation(({ input }) => services.admin.upsertPeriod(input)),
    upsertReminderRule: t.procedure
      .input(adminReminderRuleSchema)
      .mutation(({ input }) => services.admin.upsertReminderRule(input)),

    // Archive (2 procedures)
    listArchiveReports: t.procedure.query(() =>
      services.archive.listArchiveReports(),
    ),
    getArchiveReport: t.procedure
      .input(z.object({ reportId: z.string().uuid() }))
      .query(({ input }) => services.archive.getArchiveReport(input.reportId)),

    // CarryOver (1 procedure)
    executeCarryOver: t.procedure
      .input(
        z.object({
          sourceReportId: z.string().uuid(),
          targetReportId: z.string().uuid(),
        }),
      )
      .mutation(({ input }) =>
        services.carryOver.executeCarryOver(
          input.sourceReportId,
          input.targetReportId,
        ),
      ),

    // Reminders (2 procedures)
    requestReminder: t.procedure
      .input(
        z.object({
          ruleId: z.string().uuid(),
          recipientEmail: z.string().email(),
        }),
      )
      .mutation(({ input }) =>
        services.reminders.requestReminderExecution(
          input.ruleId,
          input.recipientEmail,
        ),
      ),
    listReminderExecutions: t.procedure
      .input(z.object({ ruleId: z.string().uuid() }))
      .query(({ input }) => services.reminders.listExecutions(input.ruleId)),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
```

**Total: 19 procedures** (3 + 1 + 3 + 2 + 5 + 2 + 1 + 2)

### Shared Router Contract Update

The existing `packages/shared/src/trpc/router.ts` defines 4 stub procedures. After Phase 5, it should re-export the `AppRouter` type from the API:

```typescript
// packages/shared/src/trpc/router.ts (new)
export type { AppRouter } from "@customreport/api/infrastructure/trpc/trpc.router";
```

Or, if cross-package type export is problematic with the monorepo setup, keep the AppRouter type definition in `packages/shared` and have the API import from there. This is a `Claude's discretion` decision to resolve during implementation.

## Repository Implementation Complexity Map

| Repository                     | Prisma Models                                                               | Key Operations                                             | Complexity | Notes                                                      |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| ReportSectionsPrismaRepository | ReportSection, ProjectStatus, Project, Item, Risk, Decision, Priority, User | Deep include, delete-and-recreate children in transaction  | **HIGH**   | 7 models in aggregate; toDomain mapper is ~50 lines        |
| PublicationPrismaRepository    | Report, ReportSection + all children                                        | Deep include (report + sections + children), status update | **HIGH**   | Similar to above but at Report aggregate level             |
| CarryOverPrismaRepository      | CarryOverExecution, CarryOverRecord, ReportSection + children               | `$transaction` multi-table atomic write                    | **HIGH**   | New models + transactional dedup                           |
| AdminPrismaRepository          | User, Project, Report, ReminderRule, ReminderExecution                      | Read 5 tables for snapshot, individual entity writes       | **MEDIUM** | Snapshot pattern = many queries; but each query is simple  |
| RemindersPrismaRepository      | ReminderRule, ReminderExecution                                             | CRUD with dedupeKey unique constraint                      | **MEDIUM** | New models; dedupe via `findUnique` on dedupeKey           |
| PdfExportPrismaRepository      | PdfExportJob, Report + sections                                             | Job CRUD + report read with includes                       | **MEDIUM** | New model; `getPublishedReport` reuses publication include |
| ReviewPrismaRepository         | ReportSection, User, Project                                                | Single query joining sections + users + projects           | **LOW**    | Read-only, no writes                                       |
| ArchivePrismaRepository        | Report, ReportSection + children                                            | Filtered query on published reports                        | **LOW**    | Read-only, sorted by date                                  |

## Environment Availability

| Dependency | Required By          | Available        | Version        | Fallback                                                                                                                |
| ---------- | -------------------- | ---------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Node.js    | Runtime              | Yes              | v25.9.0        | --                                                                                                                      |
| Docker     | PostgreSQL container | Yes              | 29.2.1         | Install PostgreSQL natively                                                                                             |
| pnpm       | Package management   | Yes              | (via corepack) | --                                                                                                                      |
| PostgreSQL | Database             | No (not running) | --             | `docker run -d --name cr-postgres -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=customreport postgres:15-alpine` |
| Prisma CLI | Migrations           | Yes              | 7.6.0          | --                                                                                                                      |
| psql       | Database inspection  | Not detected     | --             | Use `prisma studio` instead                                                                                             |

**Missing dependencies with fallback:**

- PostgreSQL is not running as a host service. Start via Docker: `docker run -d --name cr-postgres -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=customreport postgres:15-alpine`

**Missing dependencies with no fallback:**

- None. All tooling is available.

## Integration Test Strategy for QA-04

Integration tests for Prisma repositories should run against a real PostgreSQL database (Docker container).

**Test setup pattern:**

```typescript
// apps/api/src/test/setup.ts
import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:dev@localhost:5432/customreport_test";

export function createTestPrisma() {
  return new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
}

export async function cleanDatabase(prisma: PrismaClient) {
  // Delete in reverse dependency order
  await prisma.carryOverRecord.deleteMany();
  await prisma.carryOverExecution.deleteMany();
  await prisma.reminderExecution.deleteMany();
  await prisma.reminderRule.deleteMany();
  await prisma.pdfExportJob.deleteMany();
  await prisma.priority.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.item.deleteMany();
  await prisma.projectStatus.deleteMany();
  await prisma.reportSection.deleteMany();
  await prisma.report.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
```

**Test pattern per repository:**

```typescript
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma, cleanDatabase } from "../../test/setup";

describe("ReportSectionsPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new ReportSectionsPrismaRepository(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it("reads a section with all nested relations", async () => {
    // Seed test data directly via Prisma
    // Call repository method
    // Assert domain shape matches Zod schema
  });
});
```

## State of the Art

| Old Approach              | Current Approach                               | When Changed   | Impact                                     |
| ------------------------- | ---------------------------------------------- | -------------- | ------------------------------------------ |
| Prisma 6 (Rust engine)    | Prisma 7 (TypeScript-native, no Rust)          | Jan 2026       | 3x faster queries, 90% smaller bundle      |
| `@trpc/server` standalone | `@trpc/server/adapters/express` (built-in)     | tRPC 11        | No separate adapter package needed         |
| NestJS 10                 | NestJS 11 (TC39 decorators)                    | 2025           | Standard decorators, @nestjs/bullmq native |
| `?pgbouncer=true` in URL  | PgBouncer 1.22+ with `max_prepared_statements` | PgBouncer 1.21 | No more disabling prepared statements      |

## Open Questions

1. **Shared AppRouter type export strategy**
   - What we know: `packages/shared/src/trpc/router.ts` currently defines 4 stub procedures with `initTRPC.create()`. The API will create a real router with 19 procedures.
   - What's unclear: Whether to (a) re-export `AppRouter` type from `packages/shared` pointing to the API implementation, or (b) keep the router definition in `packages/shared` and have the API implement it, or (c) move the router entirely to `apps/api` and update shared to re-export the type.
   - Recommendation: Option (c) -- move router to `apps/api`, have `packages/shared` re-export just the `AppRouter` type. This keeps the implementation where the services live. If cross-package type imports are problematic, export the type from a separate `.d.ts` file.

2. **AdminRepository snapshot vs entity-level operations**
   - What we know: `AdminService` methods like `upsertUser` first call `getSnapshot()` (reads 4 tables), then modifies one field, then calls `saveSnapshot()`. This means every admin mutation reads ALL admin data.
   - What's unclear: Whether `saveSnapshot` should write back the entire snapshot (expensive) or just the modified entity.
   - Recommendation: Implement `AdminPrismaRepository` with entity-level operations internally (e.g., `prisma.user.upsert` for `upsertUser`), but still return a full snapshot from each mutation (re-query all 4 tables). This matches the service's return type while avoiding unnecessary writes.

3. **ProjectStatus nullable trafficLight**
   - What we know: The Zod schema has `trafficLight: trafficLightStatusSchema.nullable()` but the Prisma `ProjectStatus.status` column is `TrafficLightStatus` (not nullable). A section in `draft` status may have null traffic lights.
   - What's unclear: How to represent "no traffic light set yet" in the database.
   - Recommendation: Make `ProjectStatus.status` nullable in Prisma schema, OR only create `ProjectStatus` rows when a traffic light is actually set. The latter is cleaner -- absence of a row means null.

## Sources

### Primary (HIGH confidence)

- Existing codebase analysis (all files read directly)
- Prisma 7.6.0 installed and verified via `node_modules`
- NestJS 11 packages verified in `apps/api/package.json`
- tRPC 11.16 verified in `apps/api/package.json`

### Secondary (MEDIUM confidence)

- Prior research in `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md` (comprehensive, verified against codebase)

### Tertiary (LOW confidence)

- None. All findings are verified against the actual codebase and installed packages.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all packages verified as installed or standard NestJS ecosystem
- Architecture: HIGH -- follows existing codebase patterns (repository interfaces, constructor injection, Zod validation)
- Pitfalls: HIGH -- all critical pitfalls documented in prior research with official source citations
- Repository mapping: HIGH -- every interface read from source, every Prisma model analyzed

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no rapidly moving dependencies)
