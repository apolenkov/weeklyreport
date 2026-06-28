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
- **Archived** periods are rejected for both publish and reopen, regardless of
  role.
- Acting on an **arbitrary** (non-active) `reportId` is reserved for `admin`;
  the period management UI (admin periods tab) is the only legitimate
  arbitrary-target caller.
- Out-of-scope targets fail with a typed domain error mapped to `FORBIDDEN` /
  `NOT_FOUND`, not a generic 500.

## Capabilities

### New Capabilities

- `period-lifecycle-authz`: authorization and target-resolution contract for
  the `period.publish` / `period.reopen` mutations — server-derived active
  target for heads, archived-period rejection, and admin-only arbitrary
  `reportId`.

### Modified Capabilities

<!-- None. period-lifecycle-ui governs UI rendering/confirmation; period-dual-state
     governs atomic dual-field writes. Neither governs target resolution or the
     head-vs-admin authorization of the mutation, so no requirement there changes. -->

## Impact

- `apps/api/src/modules/period/period.service.ts` — add active-target
  resolution, archived rejection, and the admin-only arbitrary-id branch.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `period.publish` /
  `period.reopen`; thread `ctx.session` into reopen (publish already passes it).
- `apps/api/src/modules/period/period.prisma-repository.ts` — expose the
  active-target resolvers. The editable resolver mirrors `getCurrentEditableId`
  (already non-archived); the latest-published resolver adds `archived: false`
  and so diverges from the shared `getLatestPublishedId`, which does not exclude
  archived rows.
- Two new typed domain errors (`PeriodScopeError` → `FORBIDDEN`,
  `PeriodNotFoundError` → `NOT_FOUND`) + matching branches in
  `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`.
- No schema change. No UI string change (admin/head controls keep their copy).

## Non-goals

- Concurrency atomicity of the publish write (the check-then-write TOCTOU) is
  tracked separately as `BL-PUBLISH-ATOMICITY`; this change is authorization
  and target scoping only.
- Reopen-policy window/master-switch gating (UFB-052) is unchanged.
- No change to lead/viewer access — they already cannot reach these mutations.
