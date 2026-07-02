## Why

Any head can publish or reopen an arbitrary period by sending a chosen
`reportId` to `period.publish` / `period.reopen`. The service only checks
existence and current `periodStatus`; it never confirms the report is the
period the head is actually working on, never rejects archived periods, and
makes no head-vs-admin distinction. A head can therefore reopen a long-closed
historical period or republish one they were never reviewing, corrupting the
published snapshot and the on-time telemetry. This is the Codex council "High"
authorization miss from the 2026-06-28 repo-excellence review
(`docs/repo-excellence-review-2026-06-28.data.json`, council member `codex`).

## What Changes

- Period publish/reopen for a **head** resolves its target from the
  server-derived active period, not the client-supplied `reportId`. A
  `reportId` that does not match the current active target is rejected, never
  silently retargeted.
- The head's **default weekly-report resolution** (the no-`reportId` path for a
  head) migrates from `getActiveReportId` to the same deterministic,
  non-archived resolvers the lifecycle authz uses (`getCurrentEditableId`, else
  a new latest-published-non-archived resolver), so the `reportId` the head UI
  submits always equals the server-derived lifecycle target and a legitimate
  head action is never false-rejected. Lead and viewer resolution are unchanged.
- **Archived** periods are rejected for both publish and reopen, regardless of
  role.
- Acting on an **arbitrary** (non-active) `reportId` is reserved for `admin`;
  the period management UI (admin periods tab) is the only legitimate
  arbitrary-target caller.
- Out-of-scope targets fail with a typed domain error mapped to `FORBIDDEN` /
  `NOT_FOUND`, not a generic 500.
- **Admin manual period edit** (`updatePeriodManual`) rejects date-envelope
  changes (`periodStart` / `periodEnd` / `deadline`) on a **published** period,
  mirroring `deleteReport`'s existing published-state guard. This is an
  admin-path frozen-state integrity guard, distinct from the publish/reopen
  authz above but part of the same period-lifecycle hardening; `weekLabel` and
  non-published periods stay editable. Reopen reverts the state and unblocks it.

## Capabilities

### New Capabilities

- `period-lifecycle-authz`: authorization and target-resolution contract for
  the `period.publish` / `period.reopen` mutations — server-derived active
  target for heads, archived-period rejection, and admin-only arbitrary
  `reportId`.

### Modified Capabilities

<!-- None. The head default-report resolution change is captured as an ADDED
     requirement in the new period-lifecycle-authz capability — it has no durable
     spec today (it lives only in code comments). period-lifecycle-ui governs UI
     rendering/confirmation; period-dual-state governs atomic dual-field writes;
     viewer-report-navigation governs the VIEWER (not head) default resolution.
     None of those govern target resolution or the head-vs-admin authorization of
     the mutation, so no requirement there changes. -->

## Impact

- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts` — add
  `getLatestPublishedNonArchivedId` (`archived: false`, deterministic
  `periodStart desc, id desc`) alongside the existing resolvers; do NOT mutate
  the shared `getLatestPublishedId` (viewer default-report fallback).
- `apps/api/src/modules/weekly-report/weekly-report.service.ts` — migrate the
  `head` branch of `resolveDefaultReportId` from `getActiveReportId` to
  `getCurrentEditableId() ?? getLatestPublishedNonArchivedId()`; lead/viewer
  unchanged.
- `apps/api/src/modules/period/period.service.ts` — add active-target
  resolution (reusing the shared resolvers via its repository port — no second
  copy), archived rejection, and the admin-only arbitrary-id branch.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `period.publish` /
  `period.reopen`; thread `ctx.session` into reopen (publish already passes it).
- Two new typed domain errors (`PeriodScopeError` → `FORBIDDEN`,
  `PeriodNotFoundError` → `NOT_FOUND`) + matching branches in
  `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`.
- `apps/api/src/modules/admin/period-admin.service.ts` — add a published-state
  guard to `updatePeriodManual` rejecting date-envelope edits on a published
  period (reuse the existing `AdminAccessError` → `FORBIDDEN`, as `deleteReport`
  does; no new error class, no mapper branch).
- No schema change. No UI string change (admin/head controls keep their copy).

## Non-goals

- Concurrency atomicity of the publish write (the check-then-write TOCTOU) is
  tracked separately as `BL-PUBLISH-ATOMICITY`; this change is authorization
  and target scoping only.
- Reopen-policy window/master-switch gating (UFB-052) is unchanged.
- No change to lead/viewer access — they already cannot reach these mutations.
