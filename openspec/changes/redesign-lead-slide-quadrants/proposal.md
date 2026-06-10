# Redesign Lead Slide Quadrants

## Why

User feedback 2026-06-10 (slide mode, scope "Own"): the slide reads sparse
and messy — the four sections float in loose columns with dead whitespace,
and the product name is repeated on every row ("what's the point of listing
them"). The user wants a strict four-quadrant layout (Current Work | Next
Focus / Risks | Decisions), product attribution without per-row name
labels, and a visually richer slide (icons, stronger layout).

## What Changes

- `lead-unified-slide.tsx` becomes a strict 2×2 quadrant grid: framed cards
  with status stripes, per-quadrant min-height floors, real empty states
  (the model's `emptyProducts` is already computed but unused).
- The per-row 130px product-name column (`inlineProductMarker`) is removed;
  product attribution moves to the existing hero chip strip as a legend plus
  a compact per-row cue (concept-dependent: colored dot / grouped header /
  initials avatar).
- One lucide icon per quadrant; optional low-opacity icon watermark to fill
  sparse cards. Existing tokens only — no new colors without sign-off.
- Direction is NOT chosen yet: the research memo
  (`memos/quadrant-redesign-concepts.md`, frontend-design review,
  2026-06-10) offers Concepts A/B/C and recommends **B** (framed quadrants +
  hero legend dots). Implementation starts only after the user picks one.

## Capabilities

### New Capabilities

- `lead-slide-quadrants`: durable layout invariant for the lead "Own"
  slide — strict 2×2 framed quadrant grid with empty-state floors and
  single-source product attribution (hero legend + status dots, no
  per-row product names). Concept B, chosen by the user 2026-06-10.

### Modified Capabilities

<!-- none: status-color-semantics already permits adding a named status
     token, which covers the --color-status-dot-at-risk naming refactor
     (design.md D6) -->

## Impact

- `apps/web/src/components/slides/lead-unified-slide.tsx` (core),
  `slide-product-chips.tsx`, `status-slide-deck.tsx` (LeadSlideArticle).
- Purely presentational — `UnifiedSlideModel` already carries everything
  needed. The head variant has the same density problem
  (`TODO(v8.4.3-slide-redesign)`) but is a separate follow-up surface.
- Status: CAPTURED, awaiting user concept choice (A/B/C) before design /
  specs / tasks are written.
