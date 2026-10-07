# Densify the lead weekly report overview

The lead weekly report form renders one bordered section per editable unit,
each with its own footer that repeats the "Add item" affordance. On a 1280px
viewport the form is ~2900px tall and presents 33-41 visible controls in the
first viewport (the exact count depends on whether zero-opacity
pointer-guarded affordances are included). The task requires ≤35 visible
first-viewport controls and a total height ≤2458px (60% of the 4097px
pre-densification baseline), while preserving the 375px layout that already
meets its targets.

## Why

The repeated "Add item" footers and a fixed desktop minimum row height add
~470px of chrome that carries no information. The per-section gaps and the
support sections use generous spacing that scales poorly once the board is
denser.

## What changes

- The unit-level "Add item" affordance moves from a bordered unit footer into
  the unit summary header, next to the existing unit actions. The composer
  keeps mounting in the same `report-unit-footer` host so editor anchoring,
  tests, and the open-for-create contract do not change.
- Desktop lineage rows drop the `md:min-h-36` floor to `md:min-h-24`, and the
  empty-unit "No items yet" row uses tighter padding.
- The "Before you submit" card and the support section stack (risks,
  decisions, review feedback) use tighter spacing.
- The overall lead form stack moves from `space-y-6` to `space-y-5`.

## Non-goals

- No behavior changes: add, edit, verdict, submit, autosave, expand/collapse
  all keep their current flows and handlers.
- No 375px layout changes beyond what falls out of shared spacing tokens; the
  mobile targets are already met and must not regress.
