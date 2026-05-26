# Redesign slide density — v8.4.3

## Problem

The status-slide-deck component (report slides view) currently renders with
excessive vertical spacing and card padding, causing high cognitive load when
a lead reviews 20+ status items. Slide density audit (2026-05-25) identified:

1. **Card padding** — each slide-card has 24px padding; reducing to 12px saves
   visual height without sacrificing readability.
2. **Line-height gaps** — section headers and text blocks have `line-height: 1.6`,
   creating air gaps; tightening to `1.4` preserves contrast and legibility.
3. **Gap between slides** — spacing between consecutive slides is 20px; tightening
   to 12px keeps them grouped visually without cramping.

## Solution

Refactor `apps/web/src/components/slides/status-slide-deck.tsx` (line 223 TODO marker):

- Reduce card `p-6` (24px) to `p-3` (12px) for outer slide container.
- Change section-header `line-height` from `1.6` to `1.4` in
  `SlideHeader` component.
- Tighten gap between consecutive `SlideCard` from `gap-5` to `gap-3` in the
  deck grid.
- Audit `SummarySlide` and `DecisionSlide` for inherited padding; apply the
  same ratio.

## Non-goals

- Change the card border, background, or shadow styling.
- Refactor the slide carousel or keyboard navigation.
- Touch the head-role report slides view.

## Source

- `.planning/todos/pending/2026-05-25-slide-density-redesign.md` — audit
  completed, density thresholds locked.
- TODO(v8.4.3-slide-density) marker at `status-slide-deck.tsx:223`.

## Activation trigger

(Active — user re-promoted from deferred to v8.4.3 milestone 2026-05-25.)
