# Design — head slides carousel + fullscreen

## Why this reverses an accepted decision

`head-slide-density` (accepted 2026-06-10, four feedback rounds) deliberately
kept the head deck distinct from the lead deck: a left multi-lead sidebar and a
separate right SLIDE COMPLETION / readiness aside, explicitly forbidding folding
them into the section grid. The live demo on 2026-06-22 reversed that taste
decision: the head deck should mirror the lead deck's carousel + fullscreen
navigation. Because the reversal is hard to undo and surprising to a future
reader, it is recorded in `docs/adr/0004-head-slide-carousel-supersedes-sidebar.md`.

## Recorded user decisions (grill 2026-06-22)

These settle the open taste questions `head-slide-density` requires a redesign
to cite:

1. **Navigation:** top horizontal carousel, NOT a left sidebar. (locked)
2. **Active slide:** fills the viewport like the lead deck. (locked)
3. **"Same as lead" = navigation model, not data scope.** Head still sees all
   leads; lead sees only own. (sharpened during grill)
4. **Double status = the badge shown both in the left list AND in the focus
   slide.** Removed by the carousel move. (disambiguated during grill)
5. **SLIDE COMPLETION / readiness:** folded into the active slide as a compact
   strip; no separate right panel. (locked)
6. **Agent review:** fixed slot in the slide header; hover content deferred
   (Phase 54). (locked)

## Implementation notes (pin during apply)

- The head deck is `HeadSlidesClient` → `ReportSlides variant="head"` →
  `StatusSlideDeck` (`apps/web/src/components/slides/status-slide-deck.tsx`,
  head branch `HeadSlideArticle`). The left `<aside aria-label="Slides">` list
  and the right SLIDE COMPLETION `<aside>` are the surfaces being replaced.
- What is genuinely reusable vs not (Codex Act-2, Q3):
  - `DeckFullscreenOverlay` (`deck-fullscreen-overlay.tsx`) is overlay-only (exit
    pill + ESC hint), already used by the head path — reuse it as-is.
  - `LeadSlideArticle` / `LeadUnifiedSlide` are lead-HARDCODED content (lead hero,
    own product chips, 2×2 quadrants) — NOT reusable for head data. The head keeps
    its own content article (`HeadSlideArticle`), restyled for the new layout.
  - There is NO shared carousel primitive today: lead nav is `prev/next` buttons
    inside `StatusSlideDeck` (`showLeadControls`), head nav is the bottom
    `Previous/Next` buttons. The carousel must be EXTRACTED into a shared
    component, not "reused".
- Scope (Product / Leads) still drives the carousel's slide set; it stays a
  toolbar control (`ScopeToggle`). The carousel reflects the current scope.
- Keep the framed-card section grid, neutral headers + token stripes, and the
  token-only color rule (`head-slide-density` requirements that are NOT removed).
- The readiness strip reuses the existing readiness/score model that fed the
  old right panel — only its placement changes.
- No new color token; reuse existing `--color-*` tokens.

## Verification (required before archive)

`head-slide-density` requires same-viewport before/after screenshots across
one-lead, many-leads, empty-section, dense-decisions, and fullscreen states.
Produce them on the local stack (`:3000`) for user acceptance before archiving.

## Risks

- The lead content article (`LeadSlideArticle`/`LeadUnifiedSlide`) is
  lead-hardcoded; do NOT try to render head data through it. Keep
  `HeadSlideArticle` for head content and share only the overlay + the
  newly-extracted carousel.
- Extracting the carousel from `StatusSlideDeck` touches the lead `prev/next`
  path too — verify the lead deck navigation is unchanged after extraction.
- Carousel + fullscreen must preserve keyboard arrow navigation and the
  exit-fullscreen affordance the current deck already has.
