## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

`reminders.router.ts` is an orphaned duplicate of the real, scope-checked
reminder procedures inline in `trpc.router.ts` — zero production references,
lower safety than the code path actually in use. Alongside it, several small
unused surfaces have accumulated: two dead session validators in
`apps/web/src/server/auth/session.ts`, a dead `isoWeekLabel` helper plus two
unused constants in `apps/web/src/features/admin/model/admin.ts`, an
always-false `blocked` check in `section-slide-utils.ts` (the shared
`itemWorkflowStatusSchema` union does not include `"blocked"`, so the
comparison can never be true), and a PDF-export `checksum` argument that the
service thread through `markExportCompleted` but the real Prisma repository
silently drops on write and hardcodes to `null` on read — a genuine gap
between the passing contract test (against a fake in-memory repository) and
production behavior.

Separately, the review's Phase-A adversarial pass REFUTED the original P1
claim that the reminder-policy backfill script corrupts DST-observing
`fireAt` values on rerun (the rerun upsert always writes the same value, so
it is harmless). What survives is P3 hygiene: `prisma/backfill-policy-rules.ts`'s
`computeFireAt` takes an unused `_tz` parameter and duplicates
`PolicyApplicatorService.computeFireAt` with different (non-zone-aware) math,
and `policy-applicator.service.ts`'s own doc comments are misleading — they
claim the backfill script calls `applyToPeriod` (it does not; it has its own
inline upsert) and describe the service's own math as preserving the lead's
local wall-clock time across a DST boundary, when it is exact-duration minute
arithmetic on a zoned instant (pinned by
`policy-applicator.test.ts`'s "exact-24h elapsed" NY-DST-forward-jump case).

## What Changes

- Delete `apps/api/src/modules/reminders/reminders.router.ts` and its test
  file; the scope-checked procedures in `trpc.router.ts` are the only
  production reminder-execution surface.
- Delete `extractSessionToken` and `parseSessionPayload` from
  `apps/web/src/server/auth/session.ts` — zero callers outside the file's own
  declarations; `get-server-session.ts` and `get-print-route-context.ts`
  already decode sessions independently.
- Delete `isoWeekLabel` and its two now-unused supporting constants from
  `apps/web/src/features/admin/model/admin.ts`.
- Remove the always-false `blocked: item.workflowStatus === "blocked"` /
  `blocked: risk.severity === "blocked"` foreign-item checks in
  `section-slide-utils.ts`'s `crossAuthorContentToSlideForeign` — foreign
  current/next items and risks always render `blocked: false`.
- Add a persisted `checksum` column to the `PdfExportJob` Prisma model;
  `pdf-export.prisma-repository.ts`'s `saveExportJob` now writes it and
  `toExportJob` reads it back, instead of hardcoding `null` — closing the gap
  between the contract test's expectations and production behavior.
- `prisma/backfill-policy-rules.ts`: rewrite `computeFireAt` to use the
  `_tz` parameter with the same luxon zone-aware math as
  `PolicyApplicatorService.computeFireAt` (`setZone(tz).plus({minutes}).toUTC()`),
  so the parameter is no longer dead and both implementations compute
  identically for DST-observing zones; add a code comment on each function
  cross-referencing the other, since the prisma toolchain's isolated
  `tsconfig.prisma.json` cannot resolve workspace or `apps/api` imports (the
  same constraint already documented for `prisma/seed-constants.ts`).
- Correct `policy-applicator.service.ts`'s class-level doc comment (drop the
  stale claim that the backfill script calls `applyToPeriod`; it has its own
  upsert) and its `computeFireAt` doc comment (describe the math as
  exact-duration minutes added to the zoned instant, not calendar
  wall-clock preservation).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none)

### Added Requirements

- `architecture-refactor-backlog`: records the dead-code inventory found by
  the 2026-07-12 review as closed.

## Impact

- `apps/api/src/modules/reminders/{reminders.router.ts,reminders.router.test.ts}`
  (deleted)
- `apps/web/src/server/auth/session.ts`
- `apps/web/src/features/admin/model/admin.ts`
- `apps/web/src/features/slides/model/section-slide-utils.ts`
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts`
- `prisma/schema.prisma` (new migration: `PdfExportJob.checksum`)
- `prisma/backfill-policy-rules.ts`
- `apps/api/src/modules/reminders/policy-applicator.service.ts` (doc
  comments only)

Non-goals: no shared cross-toolchain helper module for `computeFireAt` (the
prisma script's isolated tsconfig cannot import `apps/api` or
`packages/shared`); no change to the reminder engine's runtime behavior for
non-DST zones (Europe/Moscow, the seeded timezone, is unaffected either way);
no revisit of the BL-19 P1 severity claim, which Phase-A already refuted.
