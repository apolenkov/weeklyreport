# Tasks — lead-demo-feedback-2026-06-19

## 1. Hero geometry parity across scopes (item 1 — CONFIRMED)

- [x] 1.1 Make the product-scope branch in `lead-slides-client.tsx` wrap
      `LeadSlideHero` at the same inset as the own-scope path (reuse the deck
      shell or match its padding token), so the hero x/y is identical across
      scopes.
- [ ] 1.2 Live-verify: re-measure hero x and y in Summary vs Product — equal
      within ±1px; content below the hero unchanged per scope.

## 2. Collapsed `+N more` styled tooltip (item 2 — CONFIRMED)

- [x] 2.1 Replace the native `title` on the collapsed-stages indicator
      (`sdlc-pipeline.tsx`) with `useSdlcTooltip` show/hide on
      enter/leave/focus/blur, passing `hiddenStagesRevealText(hiddenStages)`.
      Keep the `aria-label`.
- [x] 2.2 Test: hovering the indicator drives the shared tooltip; leaving hides
      it; aria-label retained.

## 3. Pipeline status legibility — color the `+N more` indicator (item 3 — CONFIRMED narrow)

- [x] 3.1 In `sdlc-pipeline.tsx`, colour the collapsed-stages indicator's border
      and text by the worst hidden stage's status (reuse `worstStatusOf` +
      `STATUS_CONFIG`). Recolour ONLY when the worst is `blocked` or `at-risk`;
      `on-track`/`empty` keep the existing neutral grey. Folds into 2.1 (same
      element).
- [x] 3.2 Test: a `+N more` whose worst hidden stage is at-risk/blocked carries
      that status colour; an all-`on-track`/`empty` hidden set stays neutral.

## 4. ComingSoon tooltip consistency — normalize the anchor (item 4 — CONFIRMED)

- [x] 4.1 Extract the shared ComingSoon tooltip-anchor class to a single web-side
      const that centres the badge (`left-1/2 -translate-x-1/2`) instead of
      `right-0`; apply it to all six tooltip-anchored controls (agent-review,
      version, pdf-export, nav theme + language, admin holidays). Leave the three
      inline integration badges untouched.
- [x] 4.2 Extend `coming-soon-style.test.tsx`: every tooltip control's badge uses
      the centred anchor and carries no `right-0`.
- [ ] 4.3 Live-verify the RIGHTMOST control (nav theme / slides agent-review): the
      centred badge does not clip off the viewport edge. If it does, add a
      per-control exception — do NOT revert the consolidation.

## 5. Validate

- [x] 5.1 `openspec validate lead-demo-feedback-2026-06-19 --strict` clean.
