# Tasks

## Affordance 1 — relabel the completeness counter

- [x] 1. In `apps/web/src/components/lead/sdlc-pipeline.tsx`, lift a static
      English label const (e.g. `OWN_STAGES_LABEL = "Your stages"`) near the
      other copy consts (alongside `NO_OWN_STAGES_NOTE`).
- [x] 2. Render the label inside the completeness counter pill (~line 252-270)
      so it reads as the lead's own stages, e.g. `{filled}/{total} Your stages`
      or a label adjacent to the `N/M`. Do NOT change `computeCompleteness` or
      the `completeness.total` / `completeness.filled` values.
- [x] 3. Keep the existing `title` text on the pill (complete vs. unfinished
      guidance) intact; the label is additive.

## Affordance 2 — collapsed-stage indicator with hover reveal (Mine only)

- [x] 4. Derive the hidden stages in Mine mode: in the product map, compute the
      stages excluded by the Mine filter (the complement of `visibleStages`
      against `product.stages`). Reuse `product.stages` so each hidden stage's
      `stageName` and `status` are available for the reveal.
- [x] 5. Gate the indicator: show it only when `visibilityMode === "mine"`, the
      hidden-stage count is > 0, AND `visibleStages.length > 0` (so the
      "No stages assigned to you" note still wins when the lead owns none).
- [x] 6. Render a small inert indicator (count of collapsed stages) near the
      stage grid. Follow the ComingSoon reference pattern in
      `apps/web/src/components/navigation/nav-bar.tsx`
      (`LanguageComingSoonControl`): an inert element carrying both a `title`
      (hover) and an `aria-label` (non-visual) that list the hidden stages'
      names and statuses. Build the reveal text from the hidden stages.
- [x] 7. Keep all indicator copy static English; lift any reused strings to
      named consts (no inlined literals in logic).
- [x] 8. Confirm the indicator never re-renders the hidden chips inline and does
      not alter `visibleStages`, health (left edge), or completeness.

## Verification

- [x] 9. Run the gates: `pnpm typecheck`, `pnpm lint`.
- [x] 10. Live-check in the browser (lead view): in Mine mode on a product with
      foreign/vacant stages, the indicator shows the collapsed count and the
      hover/aria reveal lists hidden statuses; switching to Everyone hides the
      indicator; a product where the lead owns all stages shows no indicator; a
      product where the lead owns none shows only the "No stages assigned to
      you" note.
- [x] 11. Confirm the counter reads "Your stages" and the `N/M` value is
      unchanged from before the relabel.
- [x] 12. `grep -nE '[а-яА-Я]'` the changed file — every match must be a
      comment or test, never hardcoded UI copy.
