## Why

A code review of `apps/web` found ten tests/comments that pass (or mislead)
regardless of the behavior they claim to check. All confirmed by reading the
current code:

- `apps/web/src/app/login-page.client.test.tsx:109` — the assertion
  `getByRole("link", { name: "Sign in with corporate SSO" })` passes because
  the `<a>` in `login-page.client.tsx` carries an explicit `aria-label`,
  which wins over descendant content in accessible-name computation
  regardless of the SVG's `aria-hidden`. The comment claims the assertion
  proves the SVG doesn't leak into the name — it can't; the aria-label alone
  determines the name whether or not `aria-hidden` is present.
- `apps/web/src/features/admin/ui/settings-tab.test.tsx:219` — the test
  titled "disables Save when shortName exceeds 16 chars" never types more
  than 16 characters into the short-name field (`settings-identity-sub-tab.tsx`)
  and never asserts the Save button is disabled; it only checks the initial
  `3/16` counter renders.
- `apps/web/src/features/dashboard/model/dashboard.test.ts:309` — the
  "pendingLeads is a strict subset of review" test uses `makeReview()` /
  `makeWeeklyReport()` fixtures where every `leadSections` author already
  appears in `review`, so it passes trivially. `dashboard-leads.ts`'s
  `buildLeadInfos` actually synthesizes leads from
  `weeklyReport.leadSections` ∪ `activity` ∪ `review` (`buildDashboardLeadRows`),
  so a lead present only via `leadSections` or `activity` but absent from the
  scoped `review` rows can still land in `pendingLeads` — exactly the leak
  the sibling `dashboard-queue.test.ts` fixture ("Nora No Section", activity-only)
  demonstrates lands in `pendingLeads` today. The documented "strict subset of
  review" invariant is false and unexercised by this test.
- `apps/web/src/features/landing/ui/tagline-cycler.test.tsx:56` — "cycles to
  a different phrase" only asserts the post-advance text is a member of
  `LANDING_TAGLINES`, which is true before and after any cycle (including no
  cycle at all); it never captures the first rendered phrase to compare
  against.
- `apps/web/src/features/report-sections/model/lead-cross-author.test.ts:7`
  — the file header claims `mapForeignItems` / `mapForeignRisks` /
  `mapForeignDecisions` / `coerceWorkflowToItemStatus` "no longer exist —
  foreign-content reads were deleted." All four are defined in
  `lead-cross-author.ts` (lines 213–325) and are called by
  `lead-form-loaded-view-model-helpers.ts` today. The false comment also
  hides that these four live mappers carry no unit tests.
- `apps/web/src/features/report-sections/model/lead-section-draft-payload.test.ts:30`
  — the module's headline invariant (a durable `stableId` must round-trip
  through `sectionToDraftPayload`, or published-lineage preservation breaks)
  is never asserted: `makeRisk`/`makeDecision` omit `stableId` entirely, and
  `toEqual` ignores keys that are `undefined` on both sides, so a mapper that
  silently dropped `stableId` would still pass every existing test.
- `apps/web/src/features/review/ui/record-comments.test.tsx:62` — only the
  responsive touch-target classes are asserted. No test exercises
  `record-comments.tsx`'s security-adjacent branching: the UUID-gated
  composer (`canCompose`), self-delete requiring `canReview` AND own
  authorship, or admin-deletes-everywhere. A regression that leaked a
  delete/compose affordance to the wrong caller would pass green.
- `apps/web/src/shared/ui/confirm-delete-dialog.test.tsx:35` — the suite
  covers Escape-to-close, Cancel click, backdrop click, focus trap, and focus
  restore, but not the Enter-only-while-confirm-focused guard at
  `confirm-delete-dialog.tsx:96` (`e.key === "Enter" && document.activeElement
=== confirmRef.current`). Nothing pins that Enter pressed elsewhere (e.g.
  the trigger, or no focus at all) does NOT confirm — the "reflexive Enter
  must never delete" safety behavior can regress silently.
- `apps/web/src/shared/ui/navigation/nav-bar.test.tsx:27` — the tRPC +
  react-query + `useSearchParams` mocks and their comment describe a
  "right-rail period badge via tRPC" that `nav-bar.tsx` no longer reads;
  `nav-bar.tsx` has no `trpc.weeklyReport.get` / `useQuery` call at all. The
  only tRPC-using child, `DevRoleSwitcher`, is gated off by
  `shouldRenderDevRoleSwitcher()` in these tests (env-gated), so the mocks
  are dead weight and the comment misrepresents the component's current
  contract.
- `apps/web/src/shared/ui/report-shell/save-now-button.test.tsx:48` +
  `apps/web/src/shared/ui/report-shell/save-now-button.tsx:37` — the test
  "renders no visible label text — icon-only button" and the component's doc
  comment ("Icon-only... Circle 32×32... the SVG glyph itself is 14×14")
  both describe a premise the component no longer implements: it renders a
  labeled pill (`min-w-[6.5rem]`, `px-4`, a visible `<span>{label}</span>` —
  `"Save"` in the pending state under test, per lines 116–122 and the inline
  comment at 97–101 which already documents the pill). The test passes only
  because its regex `/save now|saving|saved|retry save/` omits the bare word
  `"Save"`, so it cannot catch the visible label it claims is absent.

## What Changes

- Rewrite the login-page CTA test to drop the false aria-hidden causal claim
  and assert what the code actually guarantees: the link's accessible name is
  exactly the explicit `aria-label`, distinct from its own visible text
  (`"Sign in with SSO"`) — a regression that removes the `aria-label` (accessible
  name falling back to visible text) now fails the test for the right reason.
- Rewrite the settings shortName test to actually type 17+ characters into
  the short-name input and assert the Save button (`getByRole("button", {
name: /save organization identity/i })`) is disabled, plus the counter
  reflects the over-limit count.
- Rewrite the dashboard "pendingLeads is a strict subset" test to use a
  fixture with a lead present via `weeklyReport.leadSections` (or `activity`)
  but absent from `review`, matching the real `buildDashboardLeadRows`
  contract, and correct the invariant the comment documents (leads ∪ from
  `leadSections`/`activity`/`review`, not `review`-only) or fix the mapper if
  the review confirms the wider surface is unintended — this change
  documents the mapper's real, intended contract and pins it.
- Rewrite the tagline-cycler "cycles to a different phrase" test to capture
  the phrase before advancing timers and assert the phrase after advancing
  differs from it.
- Delete the false "these mappers no longer exist" file-header comment on
  `lead-cross-author.test.ts` and add direct unit tests for
  `mapForeignItems`, `mapForeignRisks`, `mapForeignDecisions`, and
  `coerceWorkflowToItemStatus`.
- Add a `stableId` round-trip assertion to `lead-section-draft-payload.test.ts`
  by giving `makeRisk`/`makeDecision` an explicit `stableId` and asserting it
  survives `sectionToDraftPayload` unchanged.
- Add authorization-branch tests to `record-comments.test.tsx`: composer
  hidden for a non-UUID anchor id, composer hidden when `canReview` is false,
  self-delete control shown only for the comment's own author with
  `canReview`, and shown for every comment when `isAdmin`.
- Add an Enter-guard test to `confirm-delete-dialog.test.tsx`: pressing Enter
  while focus is on the trigger (or nothing) does not call `onConfirm`;
  pressing Enter while the Confirm button holds focus does.
- Remove the stale tRPC/react-query/`useSearchParams` mocks and comment from
  `nav-bar.test.tsx` (or replace them with a comment matching the component's
  actual, current dependencies) since `nav-bar.tsx` reads no period data via
  tRPC today.
- Rewrite the save-now-button test and the component's doc comment to match
  reality: the button is a labeled pill with a visible `<span>{label}</span>`,
  not icon-only; assert the visible label text renders and matches the
  current state (`"Save"` / `"Saving"` / `"Saved"` / `"Retry"`), replacing the
  premise that no visible label exists.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `sweep-runtime-correctness` — extends the existing "tests must observe real
  behavior" correctness bar (previously scoped to API tests) to `apps/web`
  tests: a test's assertions must be able to fail when the behavior it names
  is wrong, and doc/file-header comments must match what the code actually
  does.

## Impact

- `apps/web/src/app/login-page.client.test.tsx` — rewritten CTA name test.
- `apps/web/src/features/admin/ui/settings-tab.test.tsx` — rewritten
  over-limit disable test.
- `apps/web/src/features/dashboard/model/dashboard.test.ts` — rewritten
  subset-invariant test/fixture.
- `apps/web/src/features/landing/ui/tagline-cycler.test.tsx` — rewritten
  cycle test.
- `apps/web/src/features/report-sections/model/lead-cross-author.test.ts` —
  corrected header comment, new mapper unit tests.
- `apps/web/src/features/report-sections/model/lead-section-draft-payload.test.ts`
  — `stableId` round-trip assertion.
- `apps/web/src/features/review/ui/record-comments.test.tsx` — new authz
  describe block.
- `apps/web/src/shared/ui/confirm-delete-dialog.test.tsx` — new Enter-guard
  tests.
- `apps/web/src/shared/ui/navigation/nav-bar.test.tsx` — removed stale mocks
  and comment.
- `apps/web/src/shared/ui/report-shell/save-now-button.test.tsx` and
  `save-now-button.tsx` — rewritten test + corrected doc comment (comment-only
  fix, no behavior change; the pill is already correct).

## Non-goals

- No production behavior changes to `login-page.client.tsx`,
  `confirm-delete-dialog.tsx`, `record-comments.tsx`, `nav-bar.tsx`, or
  `lead-cross-author.ts` — all fixes there are test/comment corrections
  against code that is already correct.
- `dashboard-leads.ts` / `dashboard.ts` behavior is changed only if the task
  list's investigation (task 3) confirms the wider leads ∪ activity ∪
  leadSections surface is an unintended scope leak; otherwise this change
  documents and pins the current, intended contract without touching
  `buildDashboardLeadRows`.
- `save-now-button.tsx` keeps its current labeled-pill rendering; this change
  only corrects the test and doc comment to match it, not a redesign back to
  icon-only.
- No new e2e/Playwright coverage — all rewrites stay within the existing
  Vitest/RTL unit-test layer.
