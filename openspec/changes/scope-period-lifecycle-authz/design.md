## Context

`period.publish` and `period.reopen` are `headProcedure` mutations
(`buildRoleMiddleware(["head", "admin"])`) that accept a client-supplied
`reportId` and forward it straight to `PeriodService`. The service
(`apps/api/src/modules/period/period.service.ts`) validates only existence and
the current `periodStatus`:

- `publishPeriod(reportId, session)` — rejects only an already-published period.
- `reopenPeriod(reportId)` — rejects only a non-published period (plus the
  UFB-052 reopen-policy window); it does not even receive the session.

Neither checks whether the report is the period the caller is actually working
on, whether it is archived, or whether the caller is a head vs an admin. Two
distinct clients call these mutations:

- Head weekly-report toolbar
  (`apps/web/src/components/weekly-report/head-publish-lock-action.tsx`) — sends
  `view.period.reportId`, normally the active period the server already resolved
  for the page.
- Admin period-management tab
  (`apps/web/src/components/admin/use-period-mutations.ts`) — legitimately sends
  arbitrary historical/scheduled `reportId`s.

The trust gap: a head can hand-craft a request with any `reportId` and the API
will publish/reopen it. This is the Codex council "High" miss in the 2026-06-28
review.

## Goals / Non-Goals

**Goals:**

- A head's publish/reopen acts only on the server-derived active target;
  a mismatched `reportId` is rejected, not retargeted.
- Archived periods are rejected for every role.
- An arbitrary (non-active) `reportId` is admin-only.
- Denials surface as typed domain errors (`FORBIDDEN` / `NOT_FOUND`), not 500.

**Non-Goals:**

- Publish concurrency atomicity (the check-then-write TOCTOU) — tracked
  separately as `BL-PUBLISH-ATOMICITY`.
- Reopen-policy window / master-switch gating (UFB-052) — left unchanged.
- Any schema change, any UI string change, any change to lead/viewer access.

## Decisions

### D1: Reuse the existing active-period resolvers, do not invent new ones

The weekly-report repository already defines the canonical resolvers:
`getCurrentEditableId` (newest non-archived `open`/`reopened` with
`periodStart <= now`) and `getLatestPublishedId` (newest `published`). Publish
targets the editable id; reopen targets the latest-published id. Expose these to
`PeriodService` through its repository port rather than duplicating the queries,
so the head's "active period" matches what the head's own weekly-report page
resolved.

- Alternative considered — re-query inside `PeriodService` with fresh Prisma
  calls. Rejected: it would create a second copy of the resolution logic that
  can drift from `weekly-report.prisma-repository.ts` (the repo already carries
  a documented `getActiveReportId` vs `getCurrentEditableId` divergence; adding
  a third copy compounds that trap).

### D2: Authorize by role inside the service, not by adding a new procedure

`period.publish` / `period.reopen` stay on `headProcedure`. The head-vs-admin
branch is decided inside `PeriodService` from `session.role`: admin skips the
active-period equality check; head must match. This keeps the 9 canonical
middleware-chain builders intact (the role-coverage CI gate compares procedures
by reference identity) and avoids splitting one mutation into two procedures.

- Alternative considered — a separate `adminProcedure`-gated arbitrary-target
  mutation plus a head-only active-target mutation. Rejected as more surface for
  the same rule; the client already knows its role and the service can branch.

### D3: Thread `ctx.session` into `period.reopen`

`reopen` currently calls `reopenPeriod(reportId)` with no session. The router
must pass `ctx.session` (mirroring `publish`) so the service can read the role
and apply the head/admin branch. This is the one router-signature change.

### D4: New typed domain error mapped in the error-mapper

Add a `PeriodScopeError` (or reuse the existing `PeriodAccessError` family) for
the out-of-scope/archived denial and map it to `FORBIDDEN` in
`trpc.error-mapper.ts`; a missing report maps to `NOT_FOUND`. This follows the
`requestReopen` convention and aligns with the separate `BL-ERROR-MAPPING`
finding (bare `Error` currently surfaces as 500).

## Data flow: before / after

Before (head): client `reportId` → `period.publish` → `publishPeriod(reportId)`
→ exists? published? → write. Any `reportId` accepted.

After (head): client `reportId` → `period.publish` → `publishPeriod(reportId,
session)` → resolve active editable id `A` → archived? reject → role=head and
`reportId != A`? reject `FORBIDDEN` → write `A`. Admin: archived? reject → write
the requested `reportId`.

## Invariants

- **period-dual-state** — preserved. This change adds authorization guards
  before the existing write; it does not touch the dual-field transition, which
  still flows through `buildTransition` / the transition module.
- **role-coverage gate** — preserved. No new or re-pointed procedures; both
  mutations stay on `headProcedure`.
- **destructive-db guard** — not touched (no schema/migration change).
- **deferred-feature pattern** — not applicable.

## Risks / Trade-offs

- [A head's UI normally already sends the active `reportId`, so the new check is
  usually a no-op for legitimate use] → low regression risk; the only behavior
  change is rejecting hand-crafted/stale ids. Add a regression test that a head
  with a stale id is rejected while the active id succeeds.
- [The active-period resolver and the head's page resolver could momentarily
  disagree during a fast open→publish→reopen sequence] → both derive from the
  same `getCurrentEditableId` / latest-published semantics, so they converge;
  the equality check fails closed (reject), never opens access.
- [Reusing `PeriodAccessError` vs adding `PeriodScopeError`] → either works;
  pick one consistent with the error-mapper branches so the code stays
  `FORBIDDEN` not 500. Decide at implementation time.

## Migration Plan

Pure code change, no migration. Deploy is API-only; the web clients already send
the values they send today (head sends the active id, admin sends arbitrary
ids), so no coordinated frontend release is required. Rollback is reverting the
service/router/error-mapper diff.

## Open Questions

- Confirm the head weekly-report toolbar always sources `reportId` from the
  server-resolved active period (it appears to via `view.period.reportId`); if a
  reopened-then-stale page can hold an old id, the head may need a refetch-then-
  retry, but failing closed with a clear `FORBIDDEN` is acceptable for v1.
