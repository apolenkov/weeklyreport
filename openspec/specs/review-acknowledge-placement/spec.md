# review-acknowledge-placement Specification

## Purpose

Place review acknowledgement inside the head's publish-and-lock flow as supporting context rather than a separate gate.

## Requirements

### Requirement: Review writes are bound to the current live report graph

Every acknowledgement, reviewer comment, and comment deletion MUST execute
inside a transaction that first locks the parent `Report` row and proves the
complete editable lifecycle (`periodStatus` is `open` or `reopened` and
`archived` is false). The transaction MUST then resolve the requested live
section and its reporting group from the current graph, reject an absent or
mismatched group, and re-check the reviewer's current database entitlement
before writing. When an acknowledgement uses a representative section to lock
and recheck a report/group pair that has multiple eligible sections, both
lookups MUST use the same deterministic ordering. Application-level pre-reads
are advisory only and MUST NOT authorize a write after a concurrent move,
publish, archive, or entitlement change. Acknowledgements MUST target a group
that has an actual section in the live report; no report/group-shaped receipt
may be created for an unrelated pair.

#### Scenario: Acknowledgement cannot outlive a lifecycle transition

- **WHEN** a report is published or archived after the acknowledgement
  request's application precheck but before its transaction acquires the report
  lock
- **THEN** the acknowledgement is rejected and no receipt is written

#### Scenario: Multi-author group retains its acknowledgement anchor

- **WHEN** a live report group has eligible sections from multiple authors
- **THEN** the acknowledgement transaction selects the same deterministic
  representative section before and after acquiring its locks
- **AND** the presence of another eligible section does not produce a false
  missing-group result

#### Scenario: Comment cannot cross a moved section or revoked designation

- **WHEN** a record's section/group or the reviewer's designation changes after
  the comment pre-read but before the write transaction
- **THEN** the transaction rechecks the current graph and entitlement and
  rejects the comment without creating a false or invisible receipt

#### Scenario: Comment deletion uses the same live scope

- **WHEN** the comment's report is archived, or its current record/group is no
  longer entitled to the actor, before deletion commits
- **THEN** deletion is rejected and the comment remains intact

### Requirement: The review-acknowledge control sits within the publish-and-lock flow

The review-acknowledge control MUST be presented, for a publish-capable reviewer
(head/admin) on a live (non-published) period, within the Publish & Lock action
cluster on the report header line — not as a separate standalone band above the
report body — so "review → acknowledge → publish & lock" reads as one
sequence. The control is
`apps/web/src/features/review/ui/review-acknowledge-bar.tsx`, rendered by
`apps/web/src/features/report-pages/ui/weekly/weekly-report-page-content.tsx` via
`AcknowledgeSurface`. Placement MUST NOT turn
acknowledgement into a publish precondition: Publish & Lock MUST remain available
regardless of whether the reviewer has acknowledged. The acknowledge action stays a
per-group acknowledge, and the head/admin "Seen by" roster still renders. Every
per-group acknowledgement action MUST also include a stable human-readable group
label in its visible text and accessible name. Two actions for different groups
MUST NOT render as indistinguishable `Acknowledge` buttons.

#### Scenario: the acknowledge control renders in the publish cluster

- **WHEN** a head opens a live (non-published) period on the report surface
- **THEN** the Acknowledge control renders within the Publish & Lock action
  cluster on the header line
- **AND** no separate acknowledgement band renders above the report body

#### Scenario: acknowledgement does not gate publish

- **WHEN** a head has not acknowledged and opens the Publish & Lock action
- **THEN** Publish & Lock is still available and can be used
- **AND** publishing does not require acknowledging first

#### Scenario: acknowledgement updates the target group

- **WHEN** a head acknowledges a group from the publish cluster
- **THEN** the per-group acknowledgement is recorded and the head/admin "Seen by"
  roster updates

#### Scenario: multi-group viewer can identify each acknowledgement target

- **WHEN** a viewer with access to two groups opens a live report
- **THEN** each per-group acknowledgement control visibly names its target group
- **AND** each control has a distinct accessible name
