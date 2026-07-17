# Tasks

## 1. Characterization pin before the one investigative behavior question (dashboard pendingLeads)

- [ ] 1.1 Before touching any fixture, add a temporary characterization test on `buildDashboardLeadRows` (or `mapReviewDashboardData`) using the exact `dashboard-queue.test.ts` "Nora No Section" activity-only fixture shape, pinning that a lead present via `leadSections`/`activity` but absent from `review` CURRENTLY appears in `pendingLeads` — so the rewrite below is provably additive, not a silent behavior change
- [ ] 1.2 Grep every caller of `mapDashboardData` / `mapReviewDashboardData` (head dashboard page, any digest/export path) to confirm whether any consumer relies on `pendingLeads` being review-only before deciding whether to correct the test or the mapper
- [ ] 1.3 Decide and record in `proposal.md`'s Non-goals (already drafted) which side is correct: if the wider surface is intended, delete the temporary pin once task 3 lands the corrected test/comment; if it is an unintended leak, escalate as a separate change and keep the pin as the regression guard

## 2. Login-page CTA: assert what aria-label actually guarantees

- [ ] 2.1 In `login-page.client.test.tsx`, rewrite the test at (current) line 101 to assert the accessible name equals the `aria-label` exactly AND differs from the link's own visible text (`"Sign in with SSO"`), proving the label overrides visible content — not a claim about the SVG's `aria-hidden`
- [ ] 2.2 Correct the leading comment (lines 105-108) to state the real mechanism: an explicit `aria-label` on the `<a>` always wins over descendant content in accessible-name computation, independent of whether the SVG carries `aria-hidden`
- [ ] 2.3 Leave the existing `aria-hidden="true"` assertion (line 98) as-is — it is a valid, separate a11y check (hiding a decorative glyph from the accessibility tree), just not proof of the name computation

## 3. Settings shortName: actually exceed 16 chars and assert Save disables

- [ ] 3.1 In `settings-tab.test.tsx`, rewrite the test at (current) line 219: after the input resolves to `"Demo"`, `fireEvent.change` the short-name input with a 17+ character value (bypasses the `maxLength` DOM attribute since it's set programmatically, not typed)
- [ ] 3.2 Assert the counter now reads the over-limit count (e.g. `/17\/16/`) and assert `screen.getByRole("button", { name: /save organization identity/i })` is disabled
- [ ] 3.3 Add a follow-up assertion that reducing the value back to ≤16 chars re-enables Save, to pin the guard is reactive, not sticky

## 4. Dashboard pendingLeads: fixture that actually exercises the subset claim

- [ ] 4.1 Rewrite `dashboard.test.ts`'s "pendingLeads is a strict subset of the scoped review input" test with a fixture where one lead exists only in `weeklyReport.leadSections` (or `activity`) and is absent from `review`, following the resolution from task 1.3
- [ ] 4.2 If the mapper's real contract is leads ∪ leadSections ∪ activity ∪ review (confirmed intended), retitle the test and rewrite the comment to state that contract accurately, asserting the leadSections-only lead DOES appear in `pendingLeads`
- [ ] 4.3 If instead `review`-only is confirmed intended, this task does not fix `dashboard-leads.ts` in this change (see Non-goals) — file the scope-leak as its own change and keep task 1.1's pin as the interim regression guard

## 5. Tagline cycler: capture-then-compare

- [ ] 5.1 In `tagline-cycler.test.tsx`, rewrite "cycles to a different phrase" to capture `screen.getByRole("paragraph").textContent` BEFORE advancing timers, then assert the post-advance text both is a member of `LANDING_TAGLINES` AND differs from the captured first phrase

## 6. Lead-cross-author: correct the header lie, add mapper tests

- [ ] 6.1 Delete or rewrite the false header comment in `lead-cross-author.test.ts` (lines 1-10) — the four mappers exist and are called by `lead-form-loaded-view-model-helpers.ts`; state that plainly instead of "no longer exist"
- [ ] 6.2 Add a `describe("mapForeignItems")` block: one row per item type (`current`/`next`) asserting the `foreign:<authorId>:<itemId>` id scheme, `productName` fallback to raw `projectId` on lookup miss, and the blocked-risk overlay applying the author's own covering risks
- [ ] 6.3 Add a `describe("mapForeignRisks")` block asserting the `foreign:<authorId>:<riskId>` id scheme and the severity pass-through
- [ ] 6.4 Add a `describe("mapForeignDecisions")` block asserting the `foreign:<authorId>:<decisionId>` id scheme and the `deadline` ISO-date-prefix formatting (both a present `Date` and a `null` deadline)
- [ ] 6.5 Add a `describe("coerceWorkflowToItemStatus")` block: each of the five known workflow strings delegates to `workflowToItemStatus`, and an unknown string falls back to `"planned"`

## 7. Lead-section draft payload: pin the stableId round-trip

- [ ] 7.1 In `lead-section-draft-payload.test.ts`, give `makeRisk`/`makeDecision` an explicit `stableId` field (a fixed UUID literal, distinct per fixture) instead of omitting it
- [ ] 7.2 Add (or extend an existing) assertion that `payload.risks[0].stableId` / `payload.decisions[0].stableId` equals the fixture's `stableId` exactly, so a mapper that drops or regenerates `stableId` fails this test

## 8. Record comments: authz branch coverage

- [ ] 8.1 In `record-comments.test.tsx`, add a test rendering with an anchor whose id is not a UUID (e.g. a synthetic client-only id) and assert no composer (`getByRole("textbox")`/`"Add a review comment"`) renders
- [ ] 8.2 Add a test with `canReview={false}` and a UUID anchor, asserting the composer does not render
- [ ] 8.3 Add a test with `canReview`, `isAdmin={false}`, and a comment authored by a DIFFERENT `reviewerId` than `currentUserId`, asserting no "Delete comment" button renders for that comment
- [ ] 8.4 Add a test with `isAdmin={true}` and a comment authored by someone other than `currentUserId`, asserting the "Delete comment" button DOES render (admin deletes everywhere)
- [ ] 8.5 Keep the existing self-authored-comment case (already implicit in `OWN_COMMENT`/`REVIEWER_ID`) as the baseline "own comment + canReview → delete shown" case, naming it explicitly if not already a standalone assertion

## 9. Confirm-delete dialog: Enter-guard regression test

- [ ] 9.1 In `confirm-delete-dialog.test.tsx`, add a test that renders the dialog, moves focus to the trigger button (or leaves focus on `document.body`), fires a `keydown` `"Enter"` on `document`, and asserts `onConfirm` was NOT called
- [ ] 9.2 Add a companion test that moves focus to the Confirm button (matching the existing tab-trap test's pattern to reach it) and fires `keydown` `"Enter"`, asserting `onConfirm` WAS called exactly once — this is the positive case proving the guard is `activeElement`-gated, not simply broken

## 10. Nav-bar: drop the stale tRPC/period mocks

- [ ] 10.1 In `nav-bar.test.tsx`, remove the `@tanstack/react-query` mock, the `../../../lib/trpc-context` mock, and their leading "right-rail period badge via tRPC" comment (lines ~27-49) since `nav-bar.tsx` has no tRPC/`useQuery` dependency today
- [ ] 10.2 Run the full file after removal to confirm no test implicitly relied on the removed mocks (e.g. via `DevRoleSwitcher` or another child actually calling `useTRPC`/`useQuery`); if one does, keep the minimal mock that child needs with a comment naming the real dependent, not "period badge"

## 11. Save-now button: labeled pill, not icon-only

- [ ] 11.1 In `save-now-button.tsx`, rewrite the doc comment at (current) lines 37-52 to describe the actual rendering: a labeled pill (`min-w-[6.5rem]`, `px-4`) with a visible `<span>{label}</span>` beside the icon, matching the inline comment at 97-101; remove the "Icon-only... Circle 32×32... 14×14 glyph" claims
- [ ] 11.2 In `save-now-button.test.tsx`, rewrite "renders no visible label text — icon-only button" to assert the opposite of its old premise: the visible label text IS present and matches the current state — e.g. render in the `pending` state and assert `screen.getByText("Save")` exists; add sibling assertions (or additional `rerender` cases) for `"Saving"`, `"Saved"`, and `"Retry"` label text in their respective states

## Gates

- [ ] 12.1 `pnpm typecheck`
- [ ] 12.2 `pnpm lint`
- [ ] 12.3 `pnpm test`
- [ ] 12.4 `openspec validate fix-vacuous-tests-web --strict`
