## Why

> **STUB — captured from 2026-06-30 demo feedback (cluster C3). NOT grilled yet.**
> Largely additive (new model beside Products), lower risk than C1/C2. Grill before
> writing specs/tasks. See `docs/feedback/demo-2026-06-30.md`.

Besides Products (with SDLC stages), leads want to report on a "project activity" —
a unit that needs weekly reporting but is **not** organized around SDLC stages.

## What Changes

- A new weekly reporting unit, "project activity": like a Product but **without an
  SDLC stage**, reported weekly with a status (risk / block), scoped to a group.
- Optionally linked to a Product; optionally tied to one or more Jira accounts
  (Jira is not integrated yet — store the reference as a plain field only).
- A lead reports on the activities they are attached to within their group.

## Capabilities

### New Capabilities

- (TBD after grill) `project-activity-reporting`: the activity model, its
  group/lead attachment, and its weekly status (no SDLC stage).

### Modified Capabilities

- (TBD after grill) report assembly / slides to surface activities beside products.

## Impact

- Existing footing: `Project` (Product) + `GroupProduct` (one-group-per-product);
  no free-standing activity and no Jira fields exist today (confirmed).
- Additive: a new model + a new section element; smaller blast radius than C1/C2.
- Decide whether an activity reuses `Item`/`Risk` rows (stage-less) or gets its own
  minimal status row — a grill question.
