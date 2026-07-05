# Proposal: redesign-lead-slide-by-product-grid

## Why

The current presentation deck splits a lead's story across a 2×2 quadrant grid (and a separate head-slide layout), so a viewer cannot see one product's current work, next focus, risks, and decisions side by side. The approved mock "Слайд 1b" replaces this with a by-product grid that reads product-first, and the grill session of 2026-07-05 (Саша + Codex adviser) locked every open design decision — the change is ready to specify.

## What Changes

- One new slide article component renders every deck slide (lead sections AND the head's own section) as: header (worst-status pill, owner name, counters, "N of M products on track" chip, Summary/Product toggle), priority-card strip, a single column-header row (Current work / Next focus / Risks / Decisions), then one card per product with product-level and per-project 4-column subsections.
- **BREAKING (internal)**: `LeadUnifiedSlide`, `LeadProductGrid`, `LeadSlideHero`, `HeadSlideArticle`, `SlideFitAdvisory`, and `SLIDE_SECTION_SOFT_CAP` are deleted in the same change; their tests go with them.
- Canvas becomes auto-height (max-width 1088px, min-width ~900px, min-height 680px, no clipping; fullscreen scrolls), reversing the fixed-frame/scroll-only decision of 2026-06-21.
- Layout comes from the mock; all colors stay inside the existing token system. Author identity uses a deterministic ~6-token cycle (lead first); author badge renders only on the first row of a consecutive same-author series.
- Grouping/sorting logic (product → project → item, `STAGE_NAMES` order then author, priority strip from items with `priorityRank` only) lives in a new pure module with unit tests.

## Capabilities

### New Capabilities

- `lead-slide-by-product-grid`: the unified by-product slide — header, priority strip, shared column grid, product cards, item anatomy (author/priority/status badges, SDLC watermark icons), legend, canvas geometry, Summary/Product modes.

### Modified Capabilities

- `lead-slide-quadrants`: all quadrant-layout requirements are REMOVED — superseded by the new capability (product chips scoping survives inside Product mode).
- `head-slide-density`: framed 2×2 section-card requirements are REMOVED; the head's own slide renders via the unified article. Deck carousel/navigation requirements stay.
- `slide-capacity-signals`: the record-section "may not fit the slide" advisory requirement is REMOVED (auto-height makes it meaningless). The admin per-lead product-count advisory stays.
- `status-slide-rendering`: the Decisions vertical-overflow constraint is REMOVED (auto-height); density-token requirements are updated to reference the new article. Mine/Everyone visibility and fullscreen-exit requirements stay.

## Non-goals

- No new item statuses (paused/postponed) — tracked separately (task #1).
- No print/PDF work, no global retheme, no changes to the lead form or data model.

## Impact

- `apps/web/src/components/slides/*` (new article + deletions), `apps/web/src/components/lead/slide-fit-advisory.tsx` (deleted), `packages/shared` (`SLIDE_SECTION_SOFT_CAP` removal), consumers: head present, viewer present, lead slides surface. No API/DB changes.
