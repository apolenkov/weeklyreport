## 1. Record the judged version the reviewer actually saw

- [ ] 1.1 In `apps/api/src/modules/review/application/review-actions.service.ts`,
      change the `postVerdict` call so `judgedVersion` is sourced from
      `input.version` (the reviewer-judged version) instead of `context.version`
- [ ] 1.2 In the same `verdict` method, return `judgedVersion: input.version`
      in the `reviewVerdictResultSchema.parse(...)` result so the response
      matches what was persisted
- [ ] 1.3 Rewrite the load-bearing comment on the `judgedVersion` line to state
      the current WHY (record the version the reviewer judged; the version lock
      below rejects a stale judgement), with no change-log or ticket tags

## 2. Add the version-conflict domain error

- [ ] 2.1 In `apps/api/src/modules/review/application/review.service.ts`, add a
      `ReviewVersionConflictError extends Error` class alongside
      `ReviewAccessError` / `ReviewNotFoundError` / `ReviewConstraintError`
- [ ] 2.2 In `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`, import
      `ReviewVersionConflictError` and add its row to `DOMAIN_ERROR_CODES`
      mapping it to `"CONFLICT"`, with an inline WHY mirroring the existing
      `SectionVersionConflictError` rationale (concurrency clash → client
      reloads the current version and re-decides)

## 3. Enforce the optimistic version lock for both verdict values

- [ ] 3.1 In
      `apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts`,
      inside the `postVerdict` transaction and BEFORE the `sectionReview.upsert`,
      re-read the section's current `version` (within the same `tx`) and throw
      `ReviewVersionConflictError` when it does not equal `params.expectedVersion`
      — so the transaction rolls back and no `SectionReview` row is written
- [ ] 3.2 Keep the `changes_requested` branch reusing `applyRevokeTransition`
      with `params.expectedVersion` and its `status = "submitted"` guard; the
      new version pre-check applies to `approved` as well as `changes_requested`
- [ ] 3.3 Confirm `judgedVersion` written by the upsert is `params.judgedVersion`
      (now `input.version`), so a passing version check stamps exactly the
      version the reviewer judged

## 4. Test the re-submit-during-window interleaving

- [ ] 4.1 Add a repository/service test: post an `approved` verdict with a
      `version` that no longer matches the section's current version (simulating
      a lead re-submit that bumped N → N+1 between context read and verdict
      write); assert it is rejected as a conflict and NO `SectionReview` row is
      created or updated
- [ ] 4.2 Add the same assertion for a `changes_requested` verdict with a stale
      `version`: rejected, no row written, and the section is NOT un-submitted
- [ ] 4.3 Add a positive test: a verdict whose `version` matches the current
      section version is recorded with `judgedVersion === input.version`

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `openspec validate review-verdict-version-lock --strict`
