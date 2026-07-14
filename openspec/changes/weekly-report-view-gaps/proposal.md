## Why

BL-18 (P1), `docs/reviews/repo-excellence-review-2026-07-14.md`.

Three defects in the weekly-report page's view derivation
(`apps/web/src/features/report-sections/ui/weekly-report-page-view.ts`,
`weekly-report-page-helpers.ts`, `use-weekly-report-page.ts`):

- **(a) `authorId` deep-link scroll no-op.** `scrollTargetProductId` is
  derived from `authoredProductIds[0]` with no content filter, while
  `focusedProductId` applies the same content filter used to decide which
  accordion panel highlights. When the author's first product has no content
  but a later authored product does, the highlight lands on the
  content-bearing product while the scroll target still points at the empty
  first one — no accordion satisfies both conditions simultaneously, so
  `?authorId=` deep-links stop scrolling into view (expand still works;
  scroll is the broken half).
- **(b) Activity-only drafts hidden with no recovery affordance.**
  `DraftHiddenSignal`'s `draftCount` is computed via
  `mapWeeklyReportLeadGroups`, which counts only product content. A draft
  section whose only content is activity entries (no product content) is
  invisible to that count, so under the default submitted-only filter it is
  hidden from both the accordion and `ActivityStatusStrip`, and the "N in
  draft — Show all" affordance never appears to surface it.
- **(c) Unmemoized full re-map on pure UI toggles.** `buildWeeklyReportPageView`
  runs the complete mapper chain on every render, including renders triggered
  by `reviewMode`/`submissionFilter` toggles that don't change the underlying
  report data — bounded but wasteful on large reports.

## What Changes

- `weekly-report-page-helpers.ts` (or wherever `scrollTargetProductId` is
  derived): derive it from `focusedProductId` instead of
  `authoredProductIds[0]`, so the scroll target and the highlighted/expanded
  accordion always agree.
- `weekly-report-page-helpers.ts`'s `draftCount` derivation: fold
  activity-only draft sections into the count — a section counts as "in
  draft" when it has draft product content OR draft activity content
  (mirroring the existing `hasAnyContent` check used elsewhere in this file),
  not only product content via `mapWeeklyReportLeadGroups`.
- `weekly-report-page-view.ts` / `use-weekly-report-page.ts`: wrap the
  mapper-chain derivation in `useMemo`, keyed on the actual data-dependent
  inputs (`reportData`, `scope`, `currentRole`, `currentUserId`,
  `focusedAuthorId`, `submissionFilter`) so a `reviewMode`-only or other pure
  UI-toggle re-render does not re-run the full chain unless one of those keys
  changed.

## Claim disposition

| Sub-claim                                                                | Disposition                              | Notes                                                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| (a) authorId deep-link scroll no-op when first authored product is empty | Confirmed                                | `scrollTargetProductId` and `focusedProductId` use different derivations; verify exact lines during implementation. |
| (b) activity-only draft sections hidden from count/affordance            | Confirmed                                | `draftCount` via `mapWeeklyReportLeadGroups` counts product content only.                                           |
| (c) unmemoized full re-map on pure UI toggles                            | Confirmed (performance, not correctness) | Bounded by report size; hardening, not a defect.                                                                    |

No refuted sub-claims — no preservation-test task required beyond the normal
regression coverage below.

## Non-goals

- No change to the submitted-only default filter itself, or to
  `ActivityStatusStrip`'s visual design — only to what feeds its count.
- No change to `mapWeeklyReportLeadGroups`'s product-content semantics for
  its OTHER callers — if it has callers beyond `draftCount` that
  legitimately want product-only counting, this change adds a
  content-inclusive derivation alongside it (or extends it with a flag),
  it does not silently change its return contract for every caller. Confirm
  call sites during implementation before choosing extend-vs-new-function.
- No route or URL-shape changes — `?authorId=` keeps its current query-param
  contract; only the scroll-target derivation changes.

## File manifest

- `apps/web/src/features/report-sections/ui/weekly-report-page-view.ts` (source, verified present, 202 lines)
- `apps/web/src/features/report-sections/ui/weekly-report-page-helpers.ts` (source, verified present, 241 lines)
- `apps/web/src/features/report-sections/ui/use-weekly-report-page.ts` (source, verified present, 188 lines)
- `apps/web/src/features/report-sections/ui/weekly-report-page.test.tsx` (test, verified present — the only existing test file covering this trio; it exercises `weekly-report-page.tsx`, which composes `use-weekly-report-page.ts`/`weekly-report-page-view.ts`/`weekly-report-page-helpers.ts`. Verified via `find`: none of the three source files has its own co-located `.test.ts`/`.test.tsx` today — new assertions land in `weekly-report-page.test.tsx`, or a new co-located test file may be added if the existing one proves too indirect for the memo/derivation assertions in Verification below.)

## Verification

- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- Unit tests (pure view-model logic, no browser needed for the derivation
  itself):
  1. Given a report where the author's first authored product has no
     content and a second authored product does, assert
     `scrollTargetProductId === focusedProductId` (both point at the
     content-bearing product).
  2. Given a report with one section that has activity-only draft content
     and no draft product content, assert `draftCount >= 1` and the
     section is included in the "N in draft" signal.
  3. Render the page view hook twice with identical data-dependent inputs
     but a changed `reviewMode`/pure-UI-only prop; assert the mapper chain's
     memoized result reference is stable (not recomputed) — use a spy or
     reference-equality check on the returned object, not a re-render count
     alone.
- Deep-link scroll is real DOM scroll behavior (`scrollIntoView`), not fully
  observable via jsdom's layout-less environment. Manual/Playwright drive
  step required in addition to unit tests:
  1. Open a weekly report where the target author's first authored product
     is empty and a later one has content, via `?authorId=<id>`.
  2. Confirm the page scrolls to and highlights the SAME (content-bearing)
     accordion panel — not two different ones, not neither.
  3. Confirm a report with only activity-only draft content shows the
     "N in draft — Show all" affordance under the default submitted-only
     filter, and clicking it reveals that section.

## Sequencing

After `lead-draft-save-integrity` (BL-01's fix for the shared draft-payload
pipeline in `use-lead-form-draft-orchestration.ts`) — both changes touch the
lead/head draft-data path that feeds the weekly-report view, and landing the
draft-integrity fix first avoids this change's tests being written against
data shapes the draft-integrity change will still be adjusting underneath
`weekly-report-page-view.ts`'s inputs.
