---
status: completed
quick_id: 260508-mkb
slug: v8-1-focused-observability-and-ui-polish
created: 2026-05-08
---

# Quick Task 260508-mkb: v8.1 focused observability and UI polish

## Scope

Tight v8.1 hardening patch:

1. Add safe request/correlation ids to client-visible tRPC failures without
   exposing server stack/cause data.
2. Persist mutation-level user action audit rows in Postgres, linked by
   correlation id.
3. Smooth current dashboard/report UI regressions: top spacing, muted empty
   product states, stable hover affordances, and navigation active-state
   clarity.
4. Remove misleading empty-state actions: dashboard collapse, empty lead report
   links, empty weekly-report publish.

## Tasks

### 1. Observability and Persistent Actions

- Files: `prisma/schema.prisma`, `prisma/migrations/*`,
  `apps/api/src/infrastructure/trpc/trpc.context.ts`,
  `apps/api/src/infrastructure/trpc/trpc.middleware.ts`,
  `apps/api/src/infrastructure/trpc/trpc.router.ts`
- Action: add `UserActionLog` persistence and request id propagation.
- Verify: focused API tests plus typecheck.

### 2. Client Error Presentation

- Files: `apps/web/src/lib/client-error-reporting.ts`,
  `apps/web/src/lib/trpc.ts`, dashboard/report error consumers.
- Action: extract request ids from tRPC error metadata and display safe,
  supportable messages.
- Verify: focused web unit tests.

### 3. UI Regression Batch

- Files: weekly report accordions/portfolio cards, app route shell spacing,
  navigation active-state tests if needed.
- Action: reduce top whitespace and stabilize empty/hover states.
- Verify: focused component tests and lint/typecheck.

## Done When

- Internal tRPC errors still show generic text but include a reference id.
- Server logs and DB action logs share the same correlation id.
- Empty product rows are visibly muted and non-jumpy.
- Empty dashboard/report actions are hidden or disabled instead of routing into
  blank pages.
- Admin settings copy no longer conflates the product name with department
  configuration.
- Focused unit tests pass; broader gates run as time allows.

## Deferred Domain Batch

- `Department` must become a first-class model before multi-department
  production use: department registry, user department assignment, head
  department scope, seed/default wipe behavior, and query filters. This is
  larger than the current UI/observability quick patch and must be handled as
  its own migration-backed batch.
