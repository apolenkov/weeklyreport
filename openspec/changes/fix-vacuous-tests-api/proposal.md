## Why

A code review of `apps/api` found seven tests that pass regardless of the
behavior they claim to check, plus two docstrings on write/read paths that
say the opposite of what the code does. All confirmed by reading the current
code:

- `apps/api/src/infrastructure/trpc/trpc.error-mapper.test.ts:476` — the
  guard test `expect(cases).toHaveLength(22)` is meant to catch a domain
  error class added to `DOMAIN_ERROR_CODES` without a corresponding
  `it.each` row. `trpc.error-mapper.ts`'s table has 31 rows; the test file
  only imports/covers 22 classes and hardcodes `22`, so the guard has
  silently stopped guarding — 9 classes ship untested: `ReviewNotFoundError`,
  `ReviewConstraintError`, `ReminderScopeError`,
  `AdminPeriodAlreadyArchivedError`, `AdminReopenRequestNotFoundError`,
  `AdminReopenRequestAlreadyProcessedError`, `AdminUserConflictError`,
  `ProjectActivityNotFoundError`, `ProjectActivityDomainError`. Several map to
  a non-default code (`ReminderScopeError`→`FORBIDDEN`,
  `AdminPeriodAlreadyArchivedError`/`AdminReopenRequestAlreadyProcessedError`/
  `AdminUserConflictError`→`CONFLICT`) where a transposed code would be a
  silent authorization/status bug that no test would catch.
- `apps/api/src/modules/archive/archive.contract.test.ts:395` — the test
  titled "returns report with sections sorted by authorName" only asserts
  both names are present via `toContain`, never their relative order. Reading
  `ArchiveService`/`archive.prisma-repository.ts` confirms no sort actually
  happens on this path (sections come through in assembled-report order) —
  the title describes behavior neither the code implements nor the test
  checks.
- `apps/api/src/modules/archive/archive.prisma-repository.ts:201` —
  `withArchiveKeyset`'s JSDoc claims "a malformed cursor decodes to null and
  the unnarrowed `where` is returned (first-page read), never a throw." The
  function body does the opposite: it throws `BadRequestException` on a
  decode failure, matching its own inline comment two lines below and the
  integration test. The header doc is simply wrong and could mislead a future
  change into "restoring" a silent first-page fallback for tampered cursors.
- `apps/api/src/modules/email/templates/escalation.template.test.tsx:85` —
  the reorder test claims to prove composite keys track element identity
  (vs. index keys, which would "collapse" on reorder). But this is a single,
  non-reconciling server render via `react-email`'s `render()` — there is no
  React commit/diff step where key strategy could matter. `map()` always
  emits its output in array order regardless of the `key` prop, so an
  index-keyed implementation would pass this exact assertion identically.
  The test cannot fail for the reason its comments claim.
- `apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts:130`
  — the `filterSectionToSharedProducts` docstring says a null-`productId`
  decision "is NOT a record on an unshared product, so the scoping has no
  reason to hide it and it is kept." The inline comment directly above the
  filter (mirroring `getCrossAuthorContent`) and the filter itself
  (`d.productId != null && sharedProductIds.has(d.productId)`) do the
  opposite — a null-`productId` decision is dropped. On a read path that
  exists specifically to bound disclosure across authors, a docstring that
  claims a leak-adjacent field is preserved when the code actually drops it
  invites a "fix" that reopens the leak the code correctly closes today.
- `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.integration.test.ts:359`
  — the test titled "returns [] when the caller has no section in the given
  reportId" never asserts the array is empty. Its only assertions
  (`not.toContain("authorName"/"items"/"risks")` on `Object.keys(row)`) probe
  keys the `getCrossAuthors` row type structurally never has at any key depth
  used here, so they pass unconditionally — the test cannot fail regardless
  of whether the caller-has-no-section case actually returns `[]`.
- `apps/api/src/modules/review/application/review-actions.service.test.ts:84`
  — `deleteComment` is stubbed on the fake repository but no test drives
  `ReviewActionsService.deleteComment`. Its not-found path (`getCommentContext`
  returns `null` → `ReviewNotFoundError`), its group-scoped reviewer check
  (`assertReviewer` against the comment's group), and cross-group rejection
  are all uncovered at the service layer — only
  `review-actions.router.test.ts` asserts a lead gets `FORBIDDEN`, which
  exercises router wiring, not the service's own authorization logic.

## What Changes

- Rewrite the error-mapper "covers every class" guard to derive its expected
  count and per-class code from `DOMAIN_ERROR_CODES` itself (imported from
  the mapper module) instead of a hand-maintained literal, and add the 9
  missing `it.each` rows so all 31 classes are exercised with their actual
  mapped code.
- Rewrite the archive contract "sorted by authorName" test to actually assert
  order (or, since no sort exists on this path, retitle it to what it
  verifies — presence of both sections — and add a real order-asserting test
  only if sorting is intentionally added; this change adds the order
  assertion against current author-name-ascending order and fixes the
  repository/service to sort, per the Non-goals/Impact call below — see task
  list for the exact chosen fix).
- Correct `withArchiveKeyset`'s JSDoc to state the actual throw-on-malformed-
  cursor behavior, matching the inline comment and the integration test.
- Replace the escalation-template reorder test with one that actually
  observes what a single static render can prove: that render output order
  follows input array order (already true and worth pinning), dropping the
  index-vs-composite-key claim the test cannot support; if key-stability
  under reconciliation is worth covering, note it as a non-goal requiring a
  client-render harness this package doesn't have.
- Correct `filterSectionToSharedProducts`'s header docstring so it states a
  null-`productId` decision is dropped (matching the code and the inline
  comment), removing the "is kept" claim.
- Rewrite the lead-form cross-author integration "no section" test to assert
  `rows` is actually `[]` (or documents+asserts the real return shape if it
  isn't `[]`), replacing the vacuous key-absence checks.
- Add `ReviewActionsService.deleteComment` unit tests: not-found
  (`ReviewNotFoundError` when `getCommentContext` returns `null`), designated-
  reviewer success, and cross-group rejection (`ReviewAccessError` when the
  caller's scope doesn't cover the comment's group).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `sweep-runtime-correctness` — extends the existing "tests must observe real
  behavior" correctness bar (previously scoped to UI runtime warnings) to API
  unit/integration tests: a test's assertions must be able to fail when the
  behavior it names is wrong, and doc comments on a function must match what
  the function does.

## Impact

- `apps/api/src/infrastructure/trpc/trpc.error-mapper.test.ts` — guard +
  9 new rows.
- `apps/api/src/modules/archive/archive.contract.test.ts` — order assertion.
- `apps/api/src/modules/archive/archive.prisma-repository.ts` — JSDoc fix
  only (no behavior change: the throw is already correct).
- `apps/api/src/modules/email/templates/escalation.template.test.tsx` —
  rewritten reorder test.
- `apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts`
  — JSDoc fix only (no behavior change: the drop is already correct and
  matches the curated Everyone lens).
- `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.integration.test.ts`
  — empty-result assertion.
- `apps/api/src/modules/review/application/review-actions.service.test.ts` —
  new `deleteComment` describe block.

## Non-goals

- Adding real sort behavior to the archive read path beyond what's needed to
  make the existing test title true is scoped to whichever the task list
  resolves as the minimal correct fix; this change does not otherwise touch
  archive pagination, filtering, or the keyset cursor mechanism.
- Client-render key-stability testing for `escalation.template.tsx` (would
  require a jsdom/RTL harness this Node-only email package doesn't carry) —
  out of scope; the rewritten test only pins what a static render can prove.
- No production authorization behavior changes anywhere in this change — both
  JSDoc fixes are comment-only corrections against code that already does the
  right (safer) thing.
- No changes to `review-actions.router.test.ts` or the tRPC router layer —
  this change adds service-layer coverage only.
