# Design — lead-demo-feedback-2026-06-19

## Item 1 — slide hero geometry parity (CONFIRMED)

### Technical cause

`LeadSlidesClient` renders the hero through two different wrappers:

- **own scope** (`scope === "own"`, default): `ReportSlides → StatusSlideDeck →
LeadSlideArticle → LeadSlideHero`. The article/deck inner inset puts the hero
  at x≈333 (≈13px from the `.slide-frame` left at x=320).
- **product scope** (`scope === "product"`): an inline `article.slide-frame p-6`
  in `LeadSlidesClient` wraps `LeadSlideHero` directly. `p-6` = 24px puts the
  hero at x≈345 and y 12px lower.

Result: switching scope shifts the status strip + scope toggle by 12px in x and
y — the reviewer's "не 1к1 боксов".

### Approach

Make both scopes wrap the hero at the same inset. Preferred: the product-scope
branch reuses the same article/deck shell (or matches its padding token) so the
hero's left inset and top offset are identical across scopes. The fix is
padding/wrapper-only; it MUST NOT change the per-scope CONTENT below the hero
(own = summary quadrants; product = product grid) — only the hero box position is
unified. Verify by re-measuring: hero x and y equal in both scopes (±1px).

## Item 2 — collapsed `+N more` styled tooltip (CONFIRMED)

`sdlc-pipeline.tsx:355-366` renders the indicator with `title=` +
`aria-label=`. Replace the native `title` with the existing `useSdlcTooltip`
(the chips already use it via `tooltip.show(rect, content)` /
`tooltip.hide()` on enter/leave/focus/blur), passing the same
`hiddenStagesRevealText(hiddenStages)` content. Keep the `aria-label` for screen
readers. No new tooltip primitive. The `SdlcTooltipProvider` already wraps the
pipeline surface (the chips render inside it), so the provider is in scope.

## Item 3 — pipeline status legibility (ASSUMPTION / NEEDS-CONFIRM)

What exists (do not rebuild): per-chip status color (`STATUS_CONFIG`), the
explicit-vs-by-risk-vs-empty border treatment (solid / dashed / dashed-pulse),
the health left-stripe, and the `N/M Your stages` completeness counter.

Open question for the reviewer:

- **ASSUMPTION (narrow):** the gap is the neutral-grey `+N more` indicator — color
  it by the worst status among the hidden stages (blocked → red, at-risk → amber),
  which folds naturally into item 2 (same element).
- **Alternative (broad):** a legibility pass so filled-vs-empty / on-track reads
  at a glance on the chips themselves.

No spec requirement here until the reviewer picks the reading.

## Item 4 — ComingSoon tooltip consistency (NEEDS-CONFIRM)

Finding: every ComingSoon control already uses the same `ComingSoonBadge`
group-hover affordance (verified in `nav-bar.tsx`, `version-coming-soon.tsx`,
`pdf-export-coming-soon.tsx`, `agent-review-coming-soon.tsx`;
`coming-soon-style.test.tsx` guards the single badge style). The only structural
difference: `AgentReviewComingSoon` carries a text label (others are icon-only
`h-8 w-8`), so its wider button + `absolute right-0` anchor place the identical
badge at a different horizontal offset.

Open questions for the reviewer:

- Is the perceived difference that anchor offset (fix: normalize the badge anchor,
  e.g. center it under the control regardless of width)?
- Should the two coexisting tooltip _languages_ — dark `sdlc-tooltip` (chips,
  item 2) vs amber `ComingSoonBadge` — be reconciled into one? That is a larger,
  app-wide decision, not implied by this feedback alone.

No spec requirement until confirmed.
