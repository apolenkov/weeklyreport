# Tasks

## 1. Pin current (broken) behavior

- [x] 1.1 Add a characterization/regression integration test in
      `apps/api/src/modules/report-sections/infrastructure/fill-from.integration.test.ts`
      (or `lead-form.prisma-repository.integration.test.ts`): start a
      `fillFromSection` call, and — inside the window between the target
      section's read and its transaction's CAS — commit a publish of the
      target's report; assert the current code lets the fill proceed and
      overwrites the now-published period's live `Item`/`Risk`/`Decision`
      rows (pins
      `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts:361`).
      Use the same paused-transaction / explicit two-phase control technique
      `record-comment-save-coordination`'s concurrency tests used.

## 2. Fix fillFromSection's transaction

- [x] 2.1 In `fillFromSection`
      (`apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts:356-409`),
      add a raw `SELECT "periodStatus" FROM "Report" WHERE "id" = <targetReportId>
FOR UPDATE` query as the FIRST statement inside the `$transaction`
      callback — the same lock `saveSection` takes
      (`report-sections.prisma-repository.ts:128-130`). This requires
      threading the target section's `reportId` into `fillFromSection` (or
      resolving it from the target-section read already available to the
      caller).
- [x] 2.2 Reject with the existing `LeadFormConstraintError` ("Cannot fill a
      section of a published report.") when the locked row's `periodStatus`
      is not `"open"` or `"reopened"`, BEFORE the target-section version CAS
      — mirroring `saveSection`'s ordering (lock check, then CAS, then
      delete-recreate).
- [x] 2.3 Re-run the test from Task 1 and confirm it now fails closed: the
      publish wins the race, the fill observes `"published"` under the lock,
      and the target's live rows are left untouched.
- [x] 2.4 Add a second, non-race case: `fillFromSection` called directly
      against an already-published target (bypassing the service precheck)
      returns the typed error and performs zero writes.

## 3. Confirm no regression on existing Fill From behavior

- [x] 3.1 Re-run `fill-from.derive.test.ts` and the existing
      `fill-from.integration.test.ts` cases (open/reopened targets, XOR
      activity-parent carry rules, version-conflict CAS) to confirm the new
      lock does not change any currently-passing scenario.

## Revoke path (same lock)

The section un-submit transition shares this exact TOCTOU seam: its
`periodStatus` gate is a service-layer read OUTSIDE the write, and
`applyRevokeTransition`
(`apps/api/src/modules/report-sections/application/revoke-transition.ts:31-43`)
guards only `status: "submitted"` (+ optional `version`) — no `periodStatus`
filter, no `Report` lock. A publish committing in the read→write window flips a
submitted section to `draft`/revoked on a now-published report (verified in
`~/work/customreport-archive/2026-07-22-mass-review/miss-1-verify.md`). Two
callers are affected:

- [x] R.1 Head single revoke — `LeadFormPrismaRepository.revokeSectionSubmission`
      (`apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts:268-278`,
      called from `LeadFormService.revokeSubmission`
      `application/lead-form.service.ts:89-91` whose `assertPeriodNotPublished`
      is the outside-the-write precheck) calls
      `applyRevokeTransition(this.prisma, ...)` — a **bare autocommit
      `updateMany`, no transaction at all**. Fix: fold the sibling
      `revokeAllSubmitted` filter (`lead-form.prisma-repository.ts:297`) into
      the transition's `updateMany` WHERE —
      `report: { periodStatus: { in: ["open", "reopened"] } }` — closing the
      race atomically in one statement (Prisma supports relation filters in
      `updateMany.where`; `revokeAllSubmitted` already does exactly this).
      Adding it inside `applyRevokeTransition` fixes BOTH callers at the seam.
- [x] R.2 Reviewer `changes_requested` verdict —
      `ReviewActionsPrismaRepository.postVerdict`
      (`apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts:208-218`)
      calls `applyRevokeTransition(tx, ...)` inside its `$transaction`, but that
      tx only version-CASes the **section** row — it never `FOR UPDATE`-locks
      the `Report` nor re-checks `periodStatus` (the `isEditablePeriod` gate is
      in `ReviewActionsService.verdict`, outside the tx). The R.1 relation-filter
      fix closes the un-submit; ADDITIONALLY gate the whole `postVerdict` tx on a
      `Report` `FOR UPDATE` periodStatus recheck (mirroring `saveSection`) so the
      `SectionReview` verdict upsert itself cannot land on a period that
      published mid-transaction.
- [x] R.3 Add a race characterization test for each caller mirroring Task 1
      (paused-transaction / two-phase publish-in-the-window), asserting current
      code drifts the section to `draft` on a published report and the fix fails
      closed (section stays `submitted`, zero writes).

## 4. Spec delta

- [x] 4.1 `fill-from-write-lock`: ADD the requirement that `fillFromSection`
      locks the parent `Report` row and re-checks `periodStatus` in-tx before
      mutating target-section rows.

## Gates

- [x] `pnpm --filter @customreport/api db:generate` — not required: API
      typecheck reported no stale Prisma-client model errors.
- [x] `pnpm typecheck` — satisfied by the required change-local
      `pnpm --filter @customreport/api typecheck` gate.
- [x] `pnpm lint` — satisfied by ESLint with `--max-warnings 0` on every
      changed path; the full monorepo lint was explicitly prohibited.
- [x] `pnpm test` — satisfied by the required targeted unit suites; the full
      monorepo suite was explicitly prohibited.
- [x] `cd apps/api && pnpm test:integration` — satisfied by the required
      targeted real-DB integration suites with file parallelism disabled.
- [x] `openspec validate fix-fillfrom-published-period-write-lock --strict`
