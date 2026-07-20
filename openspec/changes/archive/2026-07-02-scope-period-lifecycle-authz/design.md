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

### D1: One shared resolver pair for both the head UI default and the authz check

The weekly-report repository already defines `getCurrentEditableId` (newest
non-archived `open`/`reopened` with `periodStart <= now`, ordered
`periodStart desc, id desc`) and `getLatestPublishedId` (newest `published`,
archived-inclusive).

**The trap this change must close:** the head weekly-report page does NOT resolve
its default `reportId` through `getCurrentEditableId`. The non-viewer branch of
`resolveDefaultReportId` (`weekly-report.service.ts:129`) returns
`getActiveReportId`, which (a) has a published fallback, (b) has NO
`archived: false` filter on its editable query, and (c) orders by
`periodStart desc` only — no `id desc` tiebreak. So the head's submitted
`reportId` and a lifecycle authz target resolved from `getCurrentEditableId` can
diverge on a `periodStart` tie, an archived-open row, or the published-fallback
path — and the fail-closed equality check would then reject a legitimate head.
(The viewer already migrated off `getActiveReportId` for exactly this reason once
it gained a read gate; the head is now gaining a lifecycle gate, so the same
rationale applies.)

**Fix — converge the head default resolution onto the lifecycle resolvers.**
Define ONE deterministic, non-archived resolver pair and use it for BOTH the head
default resolution and the authz target:

- Editable / publish target — `getCurrentEditableId` (already non-archived and
  deterministic; no change to the query).
- Latest-published / reopen target — a NEW `getLatestPublishedNonArchivedId`
  (adds `archived: false`; otherwise identical `orderBy periodStart desc,
id desc`). It is DISTINCT from the shared `getLatestPublishedId` so the
  archived-rejection guard cannot block a head from reopening the newest
  non-archived published period when the newest published row is archived.

Migrate the `head` branch of `resolveDefaultReportId` from `getActiveReportId` to
`getCurrentEditableId() ?? getLatestPublishedNonArchivedId()`. The `lead` branch
stays on `getActiveReportId` (lead has no lifecycle gate, so there is no
divergence to close — the same reasoning the existing viewer comment records); the
viewer branch is unchanged.

Define the resolver pair ONCE in the weekly-report repository (the canonical home
of `getCurrentEditableId`) and expose both to `PeriodService` through its
repository port — no second copy. This makes the design goal real: the head's
"active period" and the lifecycle target are resolved by the same queries and
cannot drift.

Do **not** mutate the shared `getLatestPublishedId`: its docstring shows it feeds
the viewer's default-report fallback (`viewer-live-status`), so changing it would
alter that durable viewer behavior and need a MODIFIED delta plus a viewer
regression check. Add the dedicated `getLatestPublishedNonArchivedId` alongside it
instead.

- Alternative considered — leave the head default on `getActiveReportId` and make
  the authz resolver match it (the finding's option B). Rejected: in the reopen
  state `getActiveReportId`'s published fallback returns the newest published row
  WITHOUT an archived filter, so when that row is archived the archived guard
  blocks it and the older non-archived period is never offered — killing the
  "latest published is archived" scenario and its test — and its missing `id desc`
  tiebreak reintroduces the cross-call determinism hole the viewer migration
  eliminated.
- Alternative considered — add `archived: false` directly to the shared
  `getLatestPublishedId`. Rejected: it is shared with the viewer default-report
  fallback and changing it would be an undeclared durable-spec change.
- Alternative considered — re-query inside `PeriodService` with a second copy of
  the resolvers. Rejected: a second copy drifts from the weekly-report repository
  — the exact divergence this change is closing.

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

### D4: Two new distinct typed domain errors, mapped to different codes

Scope/archived denials and missing-report failures map to **different** tRPC
codes (`FORBIDDEN` vs `NOT_FOUND`), so they need **two distinct error classes**,
not one:

- `PeriodScopeError` — out-of-scope (head/admin) and archived-target denial →
  `FORBIDDEN`.
- `PeriodNotFoundError` — the report id does not exist → `NOT_FOUND`. Today both
  `publishPeriod` (~~`period.service.ts:101`) and `reopenPeriod` (~~`:146`) throw a
  bare `new Error("Report … not found.")`, which `mapDomainError` cannot
  recognize and so surfaces as `INTERNAL_SERVER_ERROR`; replace both throw sites
  with `PeriodNotFoundError`.

Add an `instanceof` branch in `trpc.error-mapper.ts` for **each** of these two
new classes only, following the `requestReopen` convention.

**Do not reuse the existing `PeriodAccessError` for either case, and do not add a
`PeriodAccessError → FORBIDDEN` branch.** `PeriodAccessError` currently carries
state/policy failures — already-published, non-published reopen, and the UFB-052
disabled-reopen / expired-window gates — all of which are unmapped today and
surface as 500. Mapping `PeriodAccessError` wholesale to `FORBIDDEN` would
silently reclassify those UFB-052 policy errors, which this change lists as a
non-goal (reopen-policy gating unchanged). `PeriodAccessError` therefore stays
exactly as it is today — unmapped, unchanged. Fixing its pre-existing 500s is out
of scope here (it belongs to the separate `BL-ERROR-MAPPING` finding).

### D5: Admin manual-edit published guard (admin-path integrity, distinct from D2)

`updatePeriodManual` (`apps/api/src/modules/admin/period-admin.service.ts`)
reads the existing row, computes a per-field diff, runs the overlap gate, and
writes — with no published-state guard. `deleteReport` in the same service
already blocks a published period ("Cannot delete a published period. Reopen it
first if needed."), so editing a published period's date envelope is the one
unguarded mutation of frozen state on the admin path.

Add the symmetric guard: after the existing row is read (`readPeriodById`, whose
projection already returns `periodState`), if `existing.periodState ===
"published"` and the computed diff would change any of `periodStart`,
`periodEnd`, or `deadline`, throw a typed domain error mapped to `FORBIDDEN`
(reuse the admin module's existing `AdminAccessError`, as `deleteReport` does, so
no new error class or mapper branch is needed). Place the check after the diff is
computed and before the overlap gate / write, so a no-op edit and a
`weekLabel`-only edit are unaffected.

Scope and remedy:

- **Three envelope fields only.** `weekLabel` is a cosmetic label, not frozen
  content; leave it editable on a published period. Do not widen this into a
  blanket published-lock.
- **Reopen-first is a real remedy.** `reopenPeriod` reverts `periodState` to
  `open` (`periodStatus = reopened`); the guard keys on the live `periodState`
  read up front, so an already-reopened period passes.

This is deliberately the admin manual-edit path, NOT the head/admin
`period.publish` / `period.reopen` authorization (D2/D4). They live in different
services and address different trust gaps; this one is a frozen-state integrity
guard, folded here because it is part of the same period-lifecycle hardening.

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

- [A head's UI sends the server-resolved default `reportId`, so the new check is
  usually a no-op for legitimate use] → low regression risk; the only behavior
  change is rejecting hand-crafted/stale ids. Add a regression test that a head
  with a stale id is rejected while the active id succeeds.
- [The head's page resolver and the authz target must not disagree] → D1 migrates
  the head default resolution onto the SAME `getCurrentEditableId` /
  `getLatestPublishedNonArchivedId` queries the authz check uses, so they resolve
  identically by construction; the equality check fails closed (reject), never
  opens access.
- [The head default resolution change touches the weekly-report read path
  (regression-heavy per CLAUDE.md)] → scoped to the `head` branch only; lead and
  viewer resolution are untouched; cover head/lead/viewer resolution and the
  archived-newest-published case with tests before relying on it.
- [Overloading `PeriodAccessError` for the new scope denial] → rejected (see
  D4). It already carries the UFB-052 state/policy errors; a shared
  `FORBIDDEN` mapping would reclassify those, touching a non-goal. The change
  adds two dedicated classes (`PeriodScopeError`, `PeriodNotFoundError`) and maps
  only those.

## Migration Plan

Pure code change, no migration. Deploy is API-only; the web clients still send a
server-resolved `reportId` (head sends `view.period.reportId`, admin sends
arbitrary ids), so no coordinated frontend release is required even though the
head's server-side default resolution changes. Rollback is reverting the
weekly-report-resolution / period-service / router / error-mapper diff.

## Open Questions

- The head weekly-report toolbar sources `reportId` from the server-resolved
  default (`view.period.reportId`). D1 converges that default onto the same
  resolvers the authz check uses, so the normal flow cannot self-reject. A head
  that has NAVIGATED to a stale/older period and acts on it still fails closed
  with a clear `FORBIDDEN`, which is acceptable for v1 (hiding/disabling the
  toolbar control for a non-target period is a `period-lifecycle-ui` concern,
  out of scope here).
