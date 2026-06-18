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

- [ ] 3. Relabel the slide `ScopeToggle` "Own" → **"Summary"** (decided, design
     Decision 2 — user-confirmed). Change only the `ScopeValue` "own" label in
     `scope-toggle.tsx`; the value/key stays "own". The head deck reuses
     ScopeToggle with `["lead","product"]`, so it is unaffected.
- [ ] 4. In `LeadSlidesClient`, accept the visibility mode; fetch
     `leadForm.crossAuthorContent` ONLY when `visibilityHydrated && isEveryone`
     AND the deck is the user's OWN (no foreign `authorId`); purge that cache on
     identity/report change and on leaving Everyone (mirror `lead-form.tsx`).
- [ ] 5. Merge foreign cross-author rows at the SLIDE-MODEL layer on Everyone
     (design Decision 3): extend `buildSectionSlideModel` (or a wrapper) to
     ACCEPT mapped foreign rows and emit NEW `SlideProduct`/`SectionSlideModel`
     objects — mirror `applyForeignProductHealth` (zero mutation). Do NOT fold
     foreign rows back into the cached `ReportSectionReadModel`. Mark merged rows
     `foreign: true` for read-only styling. Map rows via the existing
     `mapForeignItems`/`mapForeignRisks`/`mapForeignDecisions`.
- [ ] 5a. priorityRank gap (design Decision 8): foreign rows fold into the
      content grids + blocked/at-risk counters but are EXCLUDED from priority-rank
      ranking (the client mirror drops `priorityRank`). Add a test pinning this so
      a missing field is intentional, not a crash.
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
