# Design — Align SDLC Pipeline Arrows to the Chip Centerline

## Context

User feedback 2026-06-10: arrows between stage chips on the lead
report SDLC pipeline sit below the chip centerline. Geometry, verified
in code:

- `stage-chip.tsx:184` — stage cell root is
  `flex flex-col items-center gap-1`: chip button, then the assignee
  label (`text-[11px]`) below it. The label renders unconditionally
  (`assignee` or "— unassigned"), but its height varies with content
  and the chip+label block is always taller than the chip alone.
- `sdlc-pipeline.tsx:253` — stages row is
  `flex flex-wrap justify-center items-center`; each wrap unit
  (`sdlc-pipeline.tsx:270-273`) is `flex items-center` around
  `[arrow?, chip-column]`.

`items-center` centers the arrow against the full chip+label column
(~chip 35px + gap 4px + label ~16px), so the arrow midline lands
~10px below the chip midline. Same root geometry also lets chips in
one wrap row sit at different heights when label heights differ.

## Goals / Non-Goals

**Goal:** arrow vertical center == chip vertical center, with and
without assignee names, on every wrap row; chips in one row top-align.

**Non-goals:** arrow color logic, chip palette/popover/tooltip,
flex-wrap unit composition (`[arrow, chip]` stays), StageChip API.

## Decisions

### D1 — Shared chip-height token, arrow box matches it

Export one named constant from `stage-chip-config.ts` (e.g.
`STAGE_CHIP_BOX_HEIGHT = "35px"` — exact value measured at
implementation time) and apply it twice:

- chip button gets `height: STAGE_CHIP_BOX_HEIGHT` with
  `inline-flex items-center justify-center` content centering;
- the arrow wrapper in `sdlc-pipeline.tsx` gets the same height plus
  `flex items-center`.

Two boxes of identical height, both top-aligned (D2), have the same
midline by construction — no magic offset, one source of truth.
Today the chip height is only an emergent product of `p-2` +
`text-xs`; pinning it makes the contract explicit and testable.

### D2 — Top-align the row and the cell, not center

`items-center` → `items-start` on both the stages row
(`sdlc-pipeline.tsx:253`) and each `[arrow, chip]` cell (`:270-273`);
drop the now-meaningless `alignSelf: "center"` on the arrow
(`:283`). The variable-height part (assignee label) hangs below the
fixed-height part; alignment stops depending on label presence.

## Alternatives rejected

- **Negative margin / translateY on the arrow** — encodes
  `(label height + gap) / 2` as a magic offset; breaks the moment the
  label wraps or its font changes. Violates no-magic-numbers.
- **CSS grid with separate chip and label rows** — labels would need
  to leave StageChip (or subgrid), restructuring the component and the
  `[arrow, chip]` flex-wrap units for a pure alignment fix.
  Disproportionate.
- **`items-baseline`** — chip text baseline vs arrow glyph baseline
  still differ via padding/font-size; centers would only coincide by
  luck.

## Invariants (per openspec/config.yaml)

Preserves all four durable invariants — destructive-db-guard,
role-coverage-gate, period-dual-state, deferred-feature-pattern are
untouched. No data flow, no schema, no API change; CSS/markup only.

## Rollout / Risks

- No migration, flag, or API consumer concerns; head/report read-only
  surfaces reuse the same components and inherit the fix.
- [Snapshot churn] any snapshot covering the stages row changes —
  review the diff, regenerate honestly (never hand-edit).
- [Unit tests can't measure pixels] jsdom has no layout; unit tests
  pin the structural contract (shared token on both boxes, top-aligned
  row), and a live-browser visual check confirms real geometry
  (driver-verify lesson: never trust unit-only).
