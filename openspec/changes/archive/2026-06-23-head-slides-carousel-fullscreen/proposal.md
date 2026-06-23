# Head slides: carousel + fullscreen (supersede sidebar idiom)

## Problem

The head status deck (`?mode=slides`) reads as a different product from the
lead deck, and the live walk-through found it confusing:

- The slide list is a left sidebar; the active slide is a small framed panel,
  not a full-screen presentation surface like the lead deck.
- The slide status is shown twice — once as a badge on the left sidebar card
  (Blocked / Review / Ready) and again in the focused slide header.
- The `Agent review` placeholder floats in the middle of the layout and
  overlaps the SLIDE COMPLETION panel (Image #5), reading as a layout bug.
- The separate right-hand SLIDE COMPLETION / readiness panel is a head-only
  surface with no lead equivalent, so the two decks diverge.

User direction (live demo 2026-06-22): "режим слайда надо переделывать
полностью... слайды должны быть как карусель сверху, сам слайд на весь экран
как у лида... агент ревью куда-то улетел... алгоритм точно такой же как у лида
должен быть."

## Solution

Adopt the lead deck's navigation model for the head deck. This deliberately
SUPERSEDES the accepted `head-slide-density` requirement that kept the head
surfaces distinct (left lead-sidebar + separate right completion panel). The
reversal is recorded in `docs/adr/0004-head-slide-carousel-supersedes-sidebar.md`.

1. **Top carousel.** Replace the left sidebar list with a horizontal carousel
   of slide cards above the active slide. The carousel still groups by the
   current scope (Product vs Leads) — "same as lead" means the same NAVIGATION
   model, NOT the same data scope (the head still sees every lead; the lead
   sees only their own).
2. **Fullscreen active slide.** The active slide fills the viewport like the
   lead deck (reuse the lead fullscreen idiom), keeping the framed-card section
   grid and the existing exit-fullscreen + arrow-key navigation.
3. **Status shown once.** The slide status (Blocked / Review / Ready) renders
   exactly once per slide. The duplicate sidebar-card badge is removed by the
   move to a carousel.
4. **Readiness folds into the slide.** The separate right-hand SLIDE COMPLETION
   / readiness panel is folded into the active slide as a compact in-slide
   strip, so the head deck has no head-only side panel the lead deck lacks.
5. **Fixed Agent review slot.** The inert `AgentReviewComingSoon` placeholder
   gets a fixed slot in the slide header instead of floating. Only the
   placeholder is repositioned — the hover "is there anything for me" behavior
   is the real Agent-review AI feature and stays DEFERRED (Phase 54).

## Non-goals

- Building any real Agent-review behavior (Phase 54 AI/RAG) — only the inert
  placeholder is repositioned.
- Changing the head's DATA scope or authorization (head still sees all leads;
  viewer visibility is unchanged).
- Touching the lead deck (`lead-slide-quadrants` / `LeadUnifiedSlide`) — this
  change only brings the HEAD deck to the same navigation model.
- The lead Summary-scope clip fix, the head draft-visibility fix, the view-mode
  toggle fix, and the pipeline tooltip color — those land in the sibling change
  `demo-feedback-polish`.

## Source

Live demo feedback, 2026-06-22, grill-with-docs-codex session. Images #4 and #5
(head slides surface). Reverses `head-slide-density` (accepted 2026-06-10 after
four feedback rounds) — see ADR 0004.

## Activation trigger

(Active — user-directed rework of a confusing live surface.)
