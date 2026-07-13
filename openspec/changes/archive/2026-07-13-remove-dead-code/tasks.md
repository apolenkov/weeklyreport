## 1. Orphaned reminders router

- [ ] 1.1 Confirm zero production references to `remindersRouter` before
      deleting: grep for `reminders.router` / `remindersRouter` imports
      outside its own test file
- [ ] 1.2 Delete `apps/api/src/modules/reminders/reminders.router.ts` and
      `reminders.router.test.ts`
- [ ] 1.3 Confirm the scope-checked reminder-execution procedures already in
      `trpc.router.ts` cover the same `requestExecution` / `listExecutions`
      surface with no regression in test coverage

## 2. Dead web helpers and always-false check

- [ ] 2.1 Delete `extractSessionToken` and `parseSessionPayload` from
      `apps/web/src/server/auth/session.ts`; remove now-unused imports
      (`cookie`'s `parse`, `userSessionSchema`) if nothing else in the file
      needs them
- [ ] 2.2 Delete `isoWeekLabel` and its two now-unused supporting constants
      from `apps/web/src/features/admin/model/admin.ts`; remove the export
      from the module's public surface
- [ ] 2.3 `section-slide-utils.ts`: remove the always-false
      `blocked: item.workflowStatus === "blocked"` and
      `blocked: risk.severity === "blocked"` checks in
      `crossAuthorContentToSlideForeign`; set `blocked: false` directly (or
      drop the field if downstream consumers already default it) and update
      `section-slide-utils.test.ts` fixtures that assert on the removed
      comparison

## 3. PDF-export checksum persistence

- [ ] 3.1 `prisma/schema.prisma`: add `checksum String?` to `PdfExportJob`
- [ ] 3.2 Generate the migration and reset the dev DB (MVP phase: reshape +
      `migrate reset`, per repo convention)
- [ ] 3.3 `pdf-export.prisma-repository.ts`: `saveExportJob`'s Prisma
      `update` writes `checksum: job.checksum`; `toExportJob` reads
      `row.checksum` instead of hardcoding `null`
- [ ] 3.4 Update `pdf-export.integration.test.ts`'s fixtures that currently
      assert `checksum: null` for a fresh (not-yet-completed) job — those
      stay `null`; add or adjust one integration assertion that a completed
      job's checksum round-trips through the real Prisma repository

## 4. Backfill/applicator computeFireAt hygiene

- [ ] 4.1 `prisma/backfill-policy-rules.ts`: rewrite `computeFireAt` to use
      `_tz` (rename to `tz`) with luxon zone-aware math identical to
      `PolicyApplicatorService.computeFireAt`
      (`DateTime.fromJSDate(deadline, {zone: "utc"}).setZone(tz).plus({minutes: offsetMinutes}).toUTC().toJSDate()`);
      add `luxon` to the script's imports (already resolvable per
      `tsconfig.prisma.json`'s existing `paths` entry for it)
- [ ] 4.2 Add a code comment on both `computeFireAt` implementations
      cross-referencing the other by file path and noting they must be kept
      in sync by hand, since the prisma toolchain's isolated tsconfig cannot
      import `apps/api` or `packages/shared` (same constraint as
      `prisma/seed-constants.ts`)
- [ ] 4.3 `policy-applicator.service.ts`: fix the class-level doc comment's
      stale claim that the backfill script calls `applyToPeriod` (it has its
      own inline upsert); fix `computeFireAt`'s doc comment to describe
      exact-duration-minute math on the zoned instant, not wall-clock
      preservation across DST
- [ ] 4.4 Manually verify parity: run both `computeFireAt` implementations
      against the `policy-applicator.test.ts` NY-DST-forward-jump fixture
      (deadline `2026-03-08T18:00:00.000Z`, offset `-1440`, zone
      `America/New_York`) and confirm both now return the same instant

## 5. Spec delta

- [ ] 5.1 `architecture-refactor-backlog`: ADD a requirement recording the
      2026-07-12 review's dead-code inventory and the reminder-backfill
      residual hygiene fix as closed

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 `migrate reset` + reseed; confirm the app boots and a PDF export
      round-trip (request → complete) persists and reads back a non-null
      checksum
- [ ] 6.4 `openspec validate remove-dead-code --strict`
- [ ] 6.5 Adversarial review of the diff (two independent reviewers) before
      archiving
