# Phase 16: Backend Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 16-backend-hardening
**Areas discussed:** BullMQ re-enablement scope, Regression test strategy, ThemeProvider wiring, Prisma migration scope

---

## BullMQ Re-enablement Scope

| Option                             | Description                                                            | Selected |
| ---------------------------------- | ---------------------------------------------------------------------- | -------- |
| Minimal: import only               | Add BullMQModule to AppModule imports. Processors already registered.  |          |
| Standard: import + health check    | Import + add Redis/queue health indicator to /health endpoint.         |          |
| Full: import + health + Bull Board | Import + health check + Bull Board UI at /admin/queues for monitoring. | ✓        |

**User's choice:** Full: import + health + Bull Board
**Notes:** None

### Bull Board Auth

| Option                  | Description                                                 | Selected |
| ----------------------- | ----------------------------------------------------------- | -------- |
| Admin role guard        | Bull Board at /admin/queues, protected by JWT + admin role. | ✓        |
| Open (internal network) | No auth on Bull Board. Assumes Docker network isolation.    |          |

**User's choice:** Admin role guard
**Notes:** User clarified: single admin role for now since all functions are accessible to admin. Role granularity deferred to later phase.

### Graceful Shutdown

| Option                    | Description                                              | Selected |
| ------------------------- | -------------------------------------------------------- | -------- |
| Add now                   | Register onApplicationShutdown to close workers cleanly. | ✓        |
| Defer to production phase | Skip for now. Docker Compose handles stop signals.       |          |

**User's choice:** Add now

### Docker/Containerization Level

| Option                       | Description                                                                  | Selected |
| ---------------------------- | ---------------------------------------------------------------------------- | -------- |
| Verify + fix gaps            | Verify Dockerfiles work with BullMQ, fix port mismatch, add resource limits. |          |
| Minimal: no Docker changes   | BullMQ import only in code.                                                  |          |
| Full containerization review | Review all images, optimize layers, audit .dockerignore, document K8s path.  | ✓        |

**User's choice:** Full containerization review
**Notes:** User emphasized: "don't forget about containerization" and "turbo + monorepo + build system" — wants K8s-ready setup.

---

## Regression Test Strategy

### Test Organization

| Option                     | Description                                                        | Selected |
| -------------------------- | ------------------------------------------------------------------ | -------- |
| Extend existing test files | Add scenarios to existing 15 contract/integration files by module. | ✓        |
| Separate regression files  | Create dedicated \*.regression.test.ts files per module.           |          |
| Single regression suite    | One big regression.integration.test.ts with all 81 scenarios.      |          |

**User's choice:** Extend existing test files

### Test Database Strategy

| Option                             | Description                                                      | Selected |
| ---------------------------------- | ---------------------------------------------------------------- | -------- |
| In-memory mocks                    | Continue Prisma repository mock pattern. Fast, no DB dependency. | ✓        |
| Real PostgreSQL via testcontainers | True integration, catches schema drift. Slower.                  |          |
| SQLite in-memory                   | Compromise: real SQL but not identical to PostgreSQL.            |          |

**User's choice:** In-memory mocks

### Scenario Selection

| Option                            | Description                                         | Selected |
| --------------------------------- | --------------------------------------------------- | -------- |
| Claude picks from regression plan | Select 81 highest-priority scenarios.               |          |
| All P0+P1 scenarios               | Cover every P0 and P1 scenario regardless of count. | ✓        |
| You decide                        | Claude's discretion.                                |          |

**User's choice:** All P0+P1 scenarios

---

## ThemeProvider Wiring

### Default Theme

| Option                      | Description                            | Selected |
| --------------------------- | -------------------------------------- | -------- |
| Dark theme default          | Default dark, system toggle available. |          |
| System preference detection | Detect OS mode, allow user override.   | ✓        |
| Light only for now          | Force light, defer dark mode.          |          |

**User's choice:** System preference detection

### Persistence Mechanism

| Option       | Description                     | Selected |
| ------------ | ------------------------------- | -------- |
| Cookie-based | No FOUC on SSR. Works with RSC. | ✓        |
| localStorage | Client-side only. May flash.    |          |
| You decide   | Claude picks.                   |          |

**User's choice:** Cookie-based

### Theme Toggle UI

| Option                  | Description                                           | Selected |
| ----------------------- | ----------------------------------------------------- | -------- |
| Wire + toggle           | ThemeProvider + sun/moon toggle in nav-user dropdown. | ✓        |
| Wire only, no UI toggle | Provider wired, no manual override button.            |          |
| You decide              | Claude's discretion.                                  |          |

**User's choice:** Wire + toggle

---

## Prisma Migration Scope

### Migration Scope

| Option                                    | Description                                             | Selected |
| ----------------------------------------- | ------------------------------------------------------- | -------- |
| Verify alignment + fix reportId mismatch  | Confirm schema aligned, fix reportId nullable mismatch. | ✓        |
| Create explicit migration for audit trail | Named migration even if schema matches.                 |          |
| Skip — already aligned                    | Mark BE-01 as pre-satisfied.                            |          |

**User's choice:** Verify alignment + fix reportId mismatch

### reportId Resolution

| Option                            | Description                                        | Selected |
| --------------------------------- | -------------------------------------------------- | -------- |
| Make Zod optional to match Prisma | z.string().uuid().nullable(). Safer, no data loss. | ✓        |
| Make Prisma required to match Zod | Requires migration + backfill for NULLs.           |          |
| You decide                        | Claude picks.                                      |          |

**User's choice:** Make Zod optional to match Prisma

---

## Claude's Discretion

- Bull Board route/middleware setup details
- Health check indicator specifics
- Docker resource limit values
- .dockerignore audit specifics
- MSW handler update details
- Regression scenario selection from P0/P1 list
- Theme toggle icon design

## Deferred Ideas

- Bull Board role granularity — future phase
- Real PostgreSQL testcontainers — future consideration
- K8s manifests/Helm charts — future deployment phase
- Dark mode token fine-tuning — Phase 17
