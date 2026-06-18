# Tasks

## Group 1 — toolbar parity (small, low-risk)

- [ ] 1. In `lead-form.tsx`, render `RecordVisibilityToggle` in BOTH modes
     (remove the `!isSlidesMode` guard around it); keep it hydration-guarded.
     Thread the current `recordVisibility` into the slides path
     (`LeadSlidesClient`) via a prop.
- [ ] 2. Verify the toolbar control order/geometry is identical edit↔slides
     (visibility toggle + view-mode toggle + trailing utility do not shift).
     Add a test asserting the visibility toggle renders in slides mode.

## Group 2 — Everyone content in slides (the feature)

- [ ] 3. Resolve the ScopeToggle naming collision per design Decision 2:
     relabel the slide `ScopeToggle` "Own" → a layout-neutral label
     (e.g. "Summary"/"Section") so it no longer reads as "Mine". (Confirm
     wording with the user if possible.)
- [ ] 4. In `LeadSlidesClient`, accept the visibility mode; fetch
     `leadForm.crossAuthorContent` ONLY when `visibilityHydrated && isEveryone`;
     purge that cache on identity/report change and on leaving Everyone (mirror
     `lead-form.tsx`).
- [ ] 5. Merge foreign cross-author rows into the slide model on Everyone:
     extend `section-slide-utils.ts` (fold foreign items/risks/decisions on
     shared products into `buildSectionSlideModel`'s counts + grids), reusing the
     `buildProductScopedSlides` merge shape. Mark merged rows as foreign/read-only.
- [ ] 6. Keep health honest: `applyForeignProductHealth` stays always-on; assert
     the product badge is identical Mine vs Everyone.
- [ ] 7. View-only safety: add a test proving Everyone in slides does not change
     any submit / draft / published-snapshot / export payload (foreign rows are
     display-only). Highest-priority guard (design "View-only safety").
- [ ] 8. Author an ADR in `docs/adr/` recording the reversal of "slides carry
     only own records" (design Decision 1).
- [ ] 8a. Foreign `authorId` guard (Codex A-1, design Decision 6): when the
      slides URL targets another author, force/lock Mine and do NOT run the
      cross-author merge. Add a test that Everyone is unavailable on a foreign
      `authorId` deck and no co-owner rows merge onto it.
- [ ] 8b. Health/count coherence (Codex A-2, design Decision 7): merge foreign
      records by the same rules as own; add a test that a foreign blocked item
      counts identically to an own blocked item, health stays risk-derived in both
      modes, and no foreign row is double-counted.

## Both groups

- [ ] 9. Tests: toolbar parity (Group 1), Everyone-counts + Mine-only + health
     unchanged + view-only (Group 2). Live-verify at 1200px on the enriched
     small seed: slides Everyone shows co-owners' rows + fuller counters; Mine
     shows own; icons do not float across edit↔slides.
- [ ] 10. Gates green (typecheck, lint, test, format:check).
