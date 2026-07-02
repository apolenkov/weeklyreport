## 1. Characterization tests first (api, real-DB)

- [ ] 1.1 Add a real-DB integration test: an open period archived BEFORE
      `PeriodService.publishPeriod`'s write runs is NOT published — the row stays
      `archived = true`, `periodStatus` unchanged, and a `PeriodScopeError` is
      raised. It must FAIL before the fix (today the archived row is published).
- [ ] 1.2 Add the equivalent real-DB test for `review.publish` →
      `PublicationService.publishReport` → `publishAssembledReport`. FAIL before fix.
- [ ] 1.3 Add (or confirm `make-publish-atomic` already has) a real-DB regression
      test that two concurrent publishes on one open (non-archived) period still
      transition exactly once and the loser returns idempotent success with one set
      of counters — proving D2 did not turn the raced branch into an error.

## 2. Close the race in the repositories (D1 + D2)

- [ ] 2.1 `period.prisma-repository.ts::publishPeriod`: add `archived: false` to
      the `updateMany` `where`. On `count === 0`, re-read the row in the same
      `$transaction` and return a discriminated outcome distinguishing
      `reason: "raced"` (now `periodStatus = "published"`) from `reason: "archived"`
      (now `archived = true`).
- [ ] 2.2 Widen the `PeriodRepository.publishPeriod` return type accordingly and
      update its in-memory test repository to the same contract.
- [ ] 2.3 `publication.prisma-repository.ts::publishAssembledReport`: add
      `archived: false` to the `updateMany` `where`. On `count === 0`, re-read and
      return a new `"archived"` status alongside the existing `"raced"` /
      `"already-published"` / `"transitioned"`.
- [ ] 2.4 Widen the `PublishReportOutcome` type and update the in-memory /
      contract test repositories to the same contract.

## 3. Surface the archived-in-window outcome as a domain error

- [ ] 3.1 `PeriodService.publishPeriod`: map `reason: "archived"` to
      `throw new PeriodScopeError("Archived periods cannot be published.")` (reuse
      the existing class). Map `reason: "raced"` to the existing idempotent
      `{ success: true, reportId }` with NO side effects.
- [ ] 3.2 `PublicationService.publishReport`: map the `"archived"` status to a
      domain "cannot publish an archived report" error (a `PublicationAccessError`
      class, mapped to FORBIDDEN by `map-domain-errors`); keep `"raced"` as the
      idempotent-success branch.
- [ ] 3.3 Confirm `map-domain-errors` maps both archived errors to FORBIDDEN (add
      a mapper case + test only if not already covered).

## 4. Close the reopened-target bypass (D3)

- [ ] 4.1 `PeriodService.publishPeriod`: replace the blanket
      `if (report.periodStatus !== "reopened")` skip with a branch that, for a
      reopened target, asserts `reportId === getReopenedNonArchivedId()` for a
      non-admin head (admin exempt); non-reopened targets keep the
      `getCurrentEditableId` equality check. Reuse the existing
      `getReopenedNonArchivedId` port method.
- [ ] 4.2 Update the explanatory comment to state the actual invariant (reopened
      target must be the single active reopened period), with no ticket/phase prefix.

## 5. Unit tests for D3

- [ ] 5.1 A non-admin head publishing a reopened target that is NOT
      `getReopenedNonArchivedId()` is rejected with `PeriodScopeError`; FAIL before D3.
- [ ] 5.2 A non-admin head publishing the single active reopened period (its own)
      succeeds; an admin publishing any reopened target succeeds — the
      reopen→fix→republish flow is preserved.

## 6. Verify

- [ ] 6.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`,
      `pnpm lint` (`--max-warnings 0`), `pnpm test`.
- [ ] 6.2 `pnpm --filter @customreport/api test:integration` — the full real-DB
      suite stays green, including the two new archive-in-window tests.
- [ ] 6.3 Every new test fails on a revert of its corresponding fix (teeth).
