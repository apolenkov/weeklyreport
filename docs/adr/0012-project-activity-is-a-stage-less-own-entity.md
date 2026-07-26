# Project Activity is a stage-less own entity, not a reused Item or Risk

**Status:** accepted (locked via the demo-feedback grill on 2026-06-30;
implemented — see `openspec/changes/archive/2026-07-02-project-activity-reporting`)

## Context

Demo feedback (cluster C3) asked for a reporting unit that lives beside Products
but carries **no SDLC stage** — a "Project Activity" a lead reports a weekly
traffic-light status on, without the stage pipeline a Product item/risk requires.

The tempting shortcut is to reuse the existing `Item` or `Risk` model with the
stage left empty. That collides with a load-bearing invariant: the Item, Risk,
and Decision write schemas require at least one concrete SDLC stage
(`enforce-item-decision-stage-schema`, `risk-stage-integrity`). Reusing them for
a stage-less unit would mean either:

- softening that invariant to allow stage-less rows — which `risk-stage-integrity`
  exists specifically to prevent, and which the in-flight
  `fix-risk-stage-integrity-impl` is hardening — or
- threading null-stage special-casing through every stage-driven read path
  (health derivation, slide quadrants, escalations), so that "stageless when it's
  an activity" branches everywhere.

Both options spread complexity across the codebase to save one small table.

## Decision

A Project Activity is its own **minimal, stage-less entity**:

- `ProjectActivity { id, name, groupId (required, authoritative), projectId?
(label-only), jiraAccounts String[], archived }`.
- `ActivityStatus { reportSectionId, activityId, status TrafficLightStatus?,
note? }`, unique `(reportSectionId, activityId)` — a child row of
  `ReportSection`, mirroring `ProjectStatus`'s shape and default-seeding.
- It carries no stage, no items, no risks, no decisions. Admin CRUD is exposed as
  `projectActivity.*` (the live-feed `activity.*` namespace is not reused).

The FK to a product follows the `Item`/`Risk`/`ProjectStatus` `projectId`
convention, not Decision's `productId` outlier.

## Consequences

- The ≥1-stage invariant stays hard for everything it already governs; no
  stage-driven read path grows a null-stage branch.
- Activity reads are a separate, simple path (group-scoped through the section
  author, like `ProjectStatus`), so no new product-id-keyed scope dimension is
  introduced.
- The cost is one new entity plus a join table and a small status child row —
  paid once, contained.
- Stage-bearing behavior (items/risks/decisions/stages on an activity) is
  explicitly out of scope; adding any later is a new decision, not an implicit
  extension of this one.
