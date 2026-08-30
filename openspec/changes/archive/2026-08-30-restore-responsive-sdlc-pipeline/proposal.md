## Why

Exact-source browser acceptance exposed a desktop UX regression: the lead SDLC stages now render as isolated full-width rows, so the product card no longer reads as the ordered `Planning → Analysis → Design → Development → Testing → DevOps → Support` process the user expects. The regression came from the archived `reflow-sdlc-pipeline-stage-rows` decision and is currently reinforced by `openspec/specs/lead-pipeline-card/spec.md`, while `openspec/specs/ui-control-density/spec.md` still describes connector arrows.

## What Changes

- Restore a responsive SDLC pipeline: a two-column grid below 48 rem, a four-column grid from 48 rem through below 64 rem, and one compact fixed-width arrow lane at 64 rem (1024 px) and above.
- Preserve canonical stage order in every layout, with no horizontal swipe or page-level overflow. Arrows appear only in the wide lane; grid layouts remain readable without connector arrows.
- Keep every stage control at least 44 px tall through tablet widths, with full accessible names/tooltips and the existing status, ownership, and focus cues.
- Keep the collapsed `+N` summary visible and operable by tap and keyboard focus in grid and wide layouts.
- Keep the Lead context toolbar in flow below 48 rem using at most two explicit rows and 44 px navigation arrows; make it sticky from 48 rem upward with no clipping or spacer-only rows, and keep one conditional form-owned clearance source for the fixed completion rail.
- Keep the current status glyph, risk-derived status, ownership/lock cues, assignee label, tooltip, focus treatment, Mine/Everyone filtering, and collapsed-stage summary.
- Make connector arrows decorative, non-focusable, and aligned to the shared stage-chip height token.
- Replace the contradictory layout tests/spec clauses and require exact-source desktop, tablet, and phone browser evidence.

### Non-goals

- No API, persistence, status-derivation, permissions, stage-order, or data-model changes.
- No restoration of a persistent E2E/UAT/browser harness.
- No rewrite of the archived change; it remains historical provenance for the superseded decision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-pipeline-card`: stage presentation becomes an explicit three-mode responsive contract instead of unconditional full-width rows.
- `ui-control-density`: connector alignment applies to the wide horizontal mode, while narrow layouts use the overflow-safe vertical fallback.
- `lead-toolbar-presentation`: the Lead toolbar gets an explicit compact-width flow/sticky contract and touch-safe period navigation.

## Impact

- Presentation and focused tests in `apps/web/src/features/period/ui/sdlc-product-card.tsx`, `apps/web/src/features/report-sections/ui/stage-chip.tsx`, and their colocated suites.
- Durable requirements in `openspec/specs/lead-pipeline-card/spec.md`, `openspec/specs/ui-control-density/spec.md`, and `openspec/specs/lead-toolbar-presentation/spec.md` after supported sync/archive.
- No new dependency, runtime service, environment variable, migration, or production interface.
