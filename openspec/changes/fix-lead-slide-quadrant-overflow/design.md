# Design

## Context

The screenshot is the unified Summary path:
`LeadSlidesClient(scope=own)` → `ReportSlides` → `StatusSlideDeck` →
`LeadSlideArticle` → `LeadUnifiedSlide`. (The `+N more` / `MAX_VISIBLE_ITEMS=3`
truncation is in the OTHER path, the Product-scope `LeadProductGrid`, and is not
in play here.)

Clip chain (verified):

- `.slide-frame` is fixed `aspect-ratio: 16/10` + `overflow:hidden`
  (`globals.css`), so its height derives from its width.
- The article is a `flex h-full flex-col`; the quadrant grid is
  `grid min-h-0 flex-1 auto-rows-fr grid-cols-2` (`lead-unified-slide.tsx:145`),
  i.e. two EQUAL rows over the finite remaining height.
- Each `QuadrantCard` is `min-h-[var(--slide-quadrant-min)] overflow-hidden`
  (`:66`) — a floor, NO `max-height`, NO scroll, rows `line-clamp-3`.

So when the top row's content exceeds half the frame, it is clipped with no way
to reach the rest. The equal-row split also wastes the sparse bottom half.

## The real fork (this is the user's decision)

The lead asked for content that **fits** or **splits**. Three directions:

| Direction                    | What it does                                                             | Cost   | Reverses sign-off?                       |
| ---------------------------- | ------------------------------------------------------------------------ | ------ | ---------------------------------------- |
| 1. Scroll (this change)      | quadrant `overflow-y:auto` + `min-h-0` in its track; every row reachable | tiny   | No                                       |
| 2. Taller / multi-page frame | drop fixed 16:10; let the slide grow / span pages                        | medium | Yes — fixed-aspect single slide          |
| 3. Continuation slides       | spill overflow to a numbered "2/3" slide                                 | large  | Yes — one-section-one-slide + equal-zone |

Research (`R-overflow`) recommends **density tiers + continuation slides** as the
best _presentation_ UX, and both the research and the lead point away from
scroll. But directions 2 and 3 reverse the 2026-06-10 user-signed-off design
(`lead-slide-quadrants`: "visually equal framed zones", "auto-rows-fr", "every
row renders — no +N more", "concept B chosen by the user, four live feedback
rounds"). Reopening a four-round sign-off is the lead's call, not an autonomous
one (per the `live-feedback-vs-documented-decisions` rule).

**Honest framing:** scroll is chosen as the baseline because it is the only
data-loss fix that does NOT reverse a signed-off design — NOT because it is the
best UX or what the feedback asked for. It guarantees no row is lost today and
keeps the door open for direction 2 or 3 once the lead picks one.

## Decision — baseline: per-quadrant scroll within the grid track (no literal max-height)

**Chosen:** `QuadrantCard` gets `overflow-y:auto` + `min-h-0` (replacing the
current `overflow-hidden`), and the per-quadrant floor moves from the card to the
grid TRACK. Concrete mechanism (Codex N5/X3 — no literal CSS `max-height`, and the
floor and the shrink must not collide on the same property):

- The grid currently is `auto-rows-fr` (= `grid-auto-rows: 1fr`) with the floor
  on each card as `min-h-[var(--slide-quadrant-min)]`. A grid item's default
  `min-height:auto` (= min-content) lets a dense card expand its row, AND a card
  cannot hold both `min-height: var(--slide-quadrant-min)` (floor) and
  `min-height: 0` (shrink) — they are the same property.
- Fix: set the grid `grid-auto-rows: minmax(var(--slide-quadrant-min), 1fr)` so
  the TRACK carries both the equal distribution (`1fr`) and the sparse-case floor
  (`minmax` lower bound). The CARD then gets `min-h-0` + `overflow-y-auto` so it
  fills its track and scrolls the surplus inside, never expanding the track.
- Net: floor on the track, shrink+scroll on the card — no property collision.
- Spec-hygiene note: the untouched companion requirement "The framed lead slide
  fills its frame on any content change" still says "auto-rows-fr semantics … the
  `--slide-quadrant-min` floor preserved". That stays semantically true — equal
  distribution and the 120px floor are unchanged; the floor just moves from the
  card to the track via `minmax(var(--slide-quadrant-min), 1fr)`. No contradiction;
  flagged so the implementer reads the two requirements as one mechanism.

Verify the exact class interplay live (jsdom cannot measure layout). Keep the
dashed empty placeholder, the no-"+N more" rule, and the fullscreen `dvh`
behaviour. Consider dropping `line-clamp-3` on rows once the card scrolls (so long
lines wrap and stay readable) — minor, noted for implementation.

This aligns `lead-unified-slide.tsx` with what `status-slide-rendering` and
`head-slide-density` already mandate (scroll-reachable overflow), and satisfies
`lead-slide-quadrants`' "every row renders" (reachable, not clipped).

PDF: the export renders from `/print/[reportId]`, a separate template — on-screen
scroll on the slide does not affect the printed artifact.

## Alternatives considered (and why deferred, not chosen)

- **Content-aware / unequal distribution** (give the dense row more height):
  rejected here — it reverses "visually equal framed zones".
- **Auto-scale to fit:** rejected — inconsistent type sizes, weak for a deck.
- **Continuation slides / taller frame:** the better presentation answer, but
  reverses sign-off → surfaced as the user's decision, not encoded in this change.

## Test strategy

- Unit/jsdom: render `LeadUnifiedSlide` with a quadrant of many rows; assert the
  card is scroll-reachable (`overflow-y:auto` + `min-h-0`) and NOT
  `overflow:hidden`, the grid track uses `minmax(var(--slide-quadrant-min), 1fr)`,
  and every row node is present in the DOM (reachable). Live-verify the layout
  (jsdom cannot measure heights).
- Assert the equal-zone layout (`auto-rows-fr`) and `--slide-quadrant-min` floor
  are unchanged, and no "+N more" affordance is introduced.
- Live: a dense seed (or temporarily many rows) shows all rows reachable by scroll
  inside the quadrant; sparse quadrants still fill their zone.
