## Why

> **STUB — captured from 2026-06-30 demo feedback (cluster C5). Cross-cutting
> constraint, not a single feature.** See `docs/feedback/demo-2026-06-30.md`.

Stakeholders asked to "make it more compact" and to "think about mobile now —
account for it in the layout". This is a standing constraint on every surface, not
one screen: the report, slides, the lead form, and especially the new C1 review
surface (stacked per-record comments without duplication must be responsive).

## What Changes

- Treat responsive / mobile layout and density as an explicit acceptance constraint
  for new surfaces, starting with the C1 review surface.
- A density pass over the report and slides (compactness without losing the status
  signals).
- Define mobile breakpoints and the collapse behavior for the dense head dashboard
  and the report body.

## Capabilities

### New Capabilities

- (TBD) `responsive-compact-layout`: the breakpoints, density tokens, and the
  per-surface mobile collapse rules.

### Modified Capabilities

- (TBD) the existing density/layout specs (`ui-control-density`, `head-slide-density`,
  `record-dialog-layout`) extended with mobile breakpoints.

## Impact

- Cross-cutting: every new surface inherits this constraint. Sequence it AFTER C1's
  shape is settled so the review surface is designed responsive from the start
  rather than retrofitted.
