# Tasks

## 1. Characterization pin before the one real behavior change (archive section order)

- [ ] 1.1 Before touching `archive.service.ts`, add a temporary characterization test on `ArchiveService.getArchiveReport` that pins the CURRENT (unsorted, assembled-report) section order for a multi-section fixture, so the "add sorting" step below is provably additive, not a silent reorder of some other consumer's expectations
- [ ] 1.2 Grep every other caller of `ArchiveService.getArchiveReport` / `ArchiveRepository.getArchiveReport` (web archive page, any export/pdf path) to confirm none depends on today's unsorted order before sorting is introduced
- [ ] 1.3 Delete the temporary pin from 1.1 once task 3 below lands the real sort and its own order-asserting test supersedes it

## 2. Error-mapper: guard derives from the table, all 31 classes covered

- [ ] 2.1 In `trpc.error-mapper.test.ts`, import `DOMAIN_ERROR_CODES` from `trpc.error-mapper.ts` (export it if not already exported) and replace the hardcoded `expect(cases).toHaveLength(22)` with a derived check: every `DomainErrorCtor` in `DOMAIN_ERROR_CODES` has exactly one row in `cases`, and vice versa (no orphan row, no missing class)
- [ ] 2.2 Add the 9 missing `it.each` rows, each constructing the real error and asserting its actual mapped code: `ReviewNotFoundError`→`NOT_FOUND`, `ReviewConstraintError`→`BAD_REQUEST`, `ReminderScopeError`→`FORBIDDEN`, `AdminPeriodAlreadyArchivedError`→`CONFLICT`, `AdminReopenRequestNotFoundError`→`NOT_FOUND`, `AdminReopenRequestAlreadyProcessedError`→`CONFLICT`, `AdminUserConflictError`→`CONFLICT`, `ProjectActivityNotFoundError`→`NOT_FOUND`, `ProjectActivityDomainError`→`BAD_REQUEST`
- [ ] 2.3 Add the corresponding named-import lines for the 9 new classes from `../../modules/admin/index.js`, `../../modules/reminders/index.js`, `../../modules/review/index.js`, `../../modules/project-activity/index.js`
- [ ] 2.4 Run only this file (`cd apps/api && pnpm exec vitest run src/infrastructure/trpc/trpc.error-mapper.test.ts`) and confirm 31 rows pass; then intentionally mis-code one row locally (not committed) to confirm the derived guard fails, proving it's load-bearing again

## 3. Archive: real section order + a test that can catch a regression

- [ ] 3.1 In `archive.service.ts` (or wherever `getArchiveReport` assembles `report.sections` before returning), sort sections by `authorName` ascending before building the response — a small, pure `[...sections].sort(...)`, no mutation
- [ ] 3.2 Rewrite the `archive.contract.test.ts` test at (current) line 395 to assert actual order: build a fixture with sections in a non-alphabetical input order (e.g. `["Zulu Lead", "Lead Alpha"]`) and assert `result.report.sections.map(s => s.authorName)` equals the alphabetically sorted array, not just `toContain`
- [ ] 3.3 Confirm the schema (`archiveReportDetailSchema`) doesn't itself impose or strip an order (Zod arrays preserve input order) so the sort survives the `.parse()` call in `getArchiveReport`

## 4. Archive: JSDoc-only fix on `withArchiveKeyset`

- [ ] 4.1 Rewrite the JSDoc above `withArchiveKeyset` in `archive.prisma-repository.ts` to state the actual behavior: a cursor that fails to decode throws `BadRequestException` (400), matching the inline comment inside the `if (!decoded)` branch and the existing integration test; remove the "decodes to null... never a throw" claim entirely
- [ ] 4.2 No test change needed here — the existing integration test already covers the throw; confirm it still passes unmodified

## 5. Escalation template: replace the unfalsifiable reorder test

- [ ] 5.1 In `escalation.template.test.tsx`, replace the "stable composite keys under reorder" test and its comments with a test titled for what it actually proves: static server-render output follows input array order (not a key-identity claim) — keep the `[A,B]` vs `[B,A]` render + `indexOf` order assertions (they're valid for THIS claim), drop every comment implying this distinguishes composite from index keys
- [ ] 5.2 Add a one-line note (comment or Non-goal reference) that key-stability-under-reconciliation is not testable from this package's Node-only static-render harness (no jsdom/RTL), so a future reader doesn't re-add the same false claim

## 6. Lead-form cross-author scope: JSDoc-only fix

- [ ] 6.1 Rewrite `filterSectionToSharedProducts`'s header docstring in `lead-form-cross-author-scope.ts` so the null-`productId` decision sentence matches the code and the inline comment above the `decisions` filter: a null-`productId` decision IS dropped by this filter (mirroring `getCrossAuthorContent`), not kept
- [ ] 6.2 No behavior/test change needed — the drop is already correct; confirm no existing test asserts the old (wrong) "kept" claim

## 7. Lead-form integration test: assert the actual empty result

- [ ] 7.1 In `lead-form.prisma-repository.integration.test.ts`, rewrite "returns [] when the caller has no section in the given reportId" to assert what the surrounding comment already concludes is the real contract: either `expect(rows).toEqual([])` if that's what the seeded fixture produces, or — if the comment's own analysis (shared project+stage means rows ARE returned, just with null-traffic content) is correct — retitle the test to match and assert the real invariant (no foreign `authorName`/content leaks AND the specific empty/non-empty shape), replacing the structurally-untestable `not.toContain` checks with checks against the actual `getCrossAuthors` return type's real fields
- [ ] 7.2 Run this file live against the test DB (`pnpm --filter @customreport/api test:integration`, single-thread) to confirm the rewritten assertion reflects the real returned shape, not a guess

## 8. Review-actions service: cover `deleteComment`

- [ ] 8.1 Add `describe("ReviewActionsService — deleteComment")` in `review-actions.service.test.ts` with: (a) not-found — `getCommentContext` resolves `null` → `service.deleteComment` rejects with `{ name: "ReviewNotFoundError" }`; (b) success — a designated reviewer (or admin) on the comment's own group calls through to `repository.deleteComment(commentId)` and returns `{ success: true }`; (c) cross-group rejection — a reviewer scoped to group A calling on a comment whose `getCommentContext` returns group B rejects with `{ name: "ReviewAccessError" }` and `repository.deleteComment` is never called
- [ ] 8.2 Reuse the existing `buildRepo`/session fixtures in the file; only override `verdictContext`/`canReview`/`anchorGroup`-equivalent context needed for `getCommentContext`, following the file's existing `RepoOverrides` pattern (extend it with a `commentContext` override if the current shape doesn't cover it)

## Gates

- [ ] 9.1 `pnpm --filter @customreport/api db:generate`
- [ ] 9.2 `pnpm typecheck`
- [ ] 9.3 `pnpm lint`
- [ ] 9.4 `pnpm test`
- [ ] 9.5 `pnpm --filter @customreport/api test:integration`
- [ ] 9.6 `openspec validate fix-vacuous-tests-api --strict`
