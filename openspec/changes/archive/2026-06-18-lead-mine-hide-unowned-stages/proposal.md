# Mine mode hides stages the lead does not own

## Why

Today the lead SDLC pipeline always renders the full seven-stage grid per
product. Stages the lead does not own show as greyed "unassigned" chips
("Not part of this contribution"). With the Mine/Everyone visibility toggle in
**Mine**, this means the lead still sees a wall of stages that are not theirs, so
Mine and Everyone look nearly identical (only foreign chip color/lock differs).

User feedback (demo 2026-06-18): in Mine the lead should see **only their own
stages**; stages owned by someone else (or unowned) should be hidden, so "my
contribution" reads cleanly and the toggle has an obvious effect. This reverses
the earlier "show the full pipeline for context" intent — done deliberately at
the user's request.

## What Changes

- In **Mine** mode the pipeline MUST render only the stages the lead owns;
  non-owned stages (foreign-owned and unassigned/vacant) are hidden, not greyed.
- In **Everyone** mode the pipeline reveals the fuller picture: the lead's own
  stages plus foreign-owned stages (the existing locked chips) and any vacant
  (unassigned) stages, so the team view stays complete.
- Product **health** (left edge) and **own-input completeness** stay unchanged
  and honest in both modes — hiding chips MUST NOT change the health severity or
  the completeness count (both already derive from data, not from which chips
  render).
- The grid reflows to the visible chips; an empty own-stage set on a product
  (the lead contributes none of its stages) shows a small "No stages assigned to
  you" note rather than an empty grid.

## Out of scope

- A per-stage "why this status" explanation that attributes a stage's color to
  the specific covering risk/blocker. Deferred per user decision (2026-06-18):
  captured as a TODO near the chip tooltip composition, not built here. The
  existing coverage-suffix tooltip ("… by risk" / "… — status set") stays.
- The seed data that makes this demonstrable lives in the sibling change
  `enrich-small-seed-cross-author`; this change is the rendering behavior only.
- Head/viewer pipelines and slides.

## Impact

- Affected specs: ADDED requirement under `lead-pipeline-card` (Mine shows only
  own stages; Everyone reveals the rest).
- Affected code: `apps/web/src/components/lead/sdlc-pipeline.tsx` (filter the
  rendered chips by mode/ownership) and possibly
  `apps/web/src/lib/mappers/lead-form.ts` / `lead-cross-author.ts` (the grid
  builder and the cross-author overrides feed which chips exist). Tests and any
  pipeline snapshots that assume a fixed seven-chip grid must be updated.
