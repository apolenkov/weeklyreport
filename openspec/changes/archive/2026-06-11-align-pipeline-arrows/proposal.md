# Align SDLC Pipeline Arrows to the Chip Centerline

## Why

On the lead report page, the arrows between SDLC stage chips look
vertically off: they sit noticeably below the chip centerline whenever
assignee names render under the chips. User feedback 2026-06-10
confirmed this on the live pipeline.

Root cause, verified in code:

- `stage-chip.tsx:184-235` — each stage renders as a column
  (`flex flex-col items-center gap-1`): chip button on top, assignee
  label (`text-[11px]`) below.
- `sdlc-pipeline.tsx:253` — the stages row is
  `flex flex-wrap justify-center items-center`; each cell
  (`sdlc-pipeline.tsx:270-273`) is `flex items-center` wrapping
  `[arrow?, chip column]`.

`items-center` centers the arrow on the whole chip+name column, not on
the chip box, so the arrow lands ~10px below the chip centerline when a
name is present (chip ≈35px + 4px gap + ≈16px label line). A secondary
symptom of the same geometry: in a row mixing named and name-less
stages, the chips themselves sit at different heights.

## What Changes

CSS/markup-only fix in two files, no behavior or API change:

1. Lift the chip box height into a named shared constant (CSS var) in
   `stage-chip-config.ts`; the chip button gets that fixed height with
   internally centered content.
2. In `sdlc-pipeline.tsx`, switch the stages row and each stage cell to
   top alignment, and give the arrow wrapper the same chip-height token
   with internal vertical centering — arrow center == chip center by
   construction, with or without assignee names, on every wrap row.
3. Unit test pins the structural contract (shared height token on both
   chip and arrow, top-aligned row); live-browser visual check confirms
   real geometry (driver-verify lesson: never trust unit-only).

See `design.md` for the alternatives weighed (baseline alignment,
grid restructure).

## Non-goals

- No change to arrow color logic (`mine`-adjacency accent), chip status
  palette, popover, or tooltip behavior.
- No change to flex-wrap behavior: cells still wrap as
  `[arrow, chip]` units, `justify-center` stays.
- No StageChip API change; the assignee label stays inside StageChip.
- Head/report read-only surfaces reusing these components get the fix
  for free; no separate work there.

## Impact

- `apps/web/src/components/lead/stage-chip-config.ts` — named chip
  height constant.
- `apps/web/src/components/lead/stage-chip.tsx` — fixed-height chip
  button.
- `apps/web/src/components/lead/sdlc-pipeline.tsx` — row/cell/arrow
  alignment (~line 253-288).
- `sdlc-pipeline.test.tsx` — new structural assertions; any snapshot
  capturing the stages row regenerated honestly after diff review.
- No shared/ui/api surface; none of the 4 load-bearing invariants is
  touched. Durable-spec delta: `specs/ui-control-density/spec.md`
  (ADDED) — arrow centers on the chip box via the shared height token,
  extending that capability's existing one-height-token property.
