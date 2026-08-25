# review-acknowledge-placement Specification

## Purpose

Place review acknowledgement inside the head's publish-and-lock flow as supporting context rather than a separate gate.

## Requirements

### Requirement: The review-acknowledge control sits within the publish-and-lock flow

The review-acknowledge control MUST be presented, for a publish-capable reviewer
(head/admin) on a live (non-published) period, within the Publish & Lock action
cluster on the report header line — not as a separate standalone band above the
report body (head HF1) — so "review → acknowledge → publish & lock" reads as one
sequence. The control is
`apps/web/src/features/review/ui/review-acknowledge-bar.tsx`, rendered by
`apps/web/src/features/report-pages/ui/weekly/weekly-report-page-content.tsx` via
`AcknowledgeSurface`. Relocation MUST NOT turn
acknowledgement into a publish precondition: Publish & Lock MUST remain available
regardless of whether the reviewer has acknowledged — this is the plain reading of
the walkthrough note, which asks to co-locate the control, not to add a new gate.
The acknowledge action's own semantics MUST be unchanged by the move: it stays a
per-group acknowledge, and the head/admin "Seen by" roster still renders. Every
per-group acknowledgement action MUST also include a stable human-readable group
label in its visible text and accessible name. Two actions for different groups
MUST NOT render as indistinguishable `Acknowledge` buttons.

#### Scenario: the acknowledge control renders in the publish cluster

- **WHEN** a head opens a live (non-published) period on the report surface
- **THEN** the Acknowledge control renders within the Publish & Lock action
  cluster on the header line
- **AND** it is no longer a separate standalone band above the report body

#### Scenario: acknowledgement does not gate publish

- **WHEN** a head has not acknowledged and opens the Publish & Lock action
- **THEN** Publish & Lock is still available and can be used
- **AND** publishing does not require acknowledging first

#### Scenario: acknowledge semantics are unchanged

- **WHEN** a head acknowledges a group from the relocated control
- **THEN** the per-group acknowledgement is recorded and the head/admin "Seen by"
  roster updates, exactly as before the move

#### Scenario: multi-group viewer can identify each acknowledgement target

- **WHEN** a viewer with access to two groups opens a live report
- **THEN** each per-group acknowledgement control visibly names its target group
- **AND** each control has a distinct accessible name
