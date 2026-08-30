# carry-over-automation Specification

## Purpose

Carry eligible unfinished work into a new reporting period automatically through one race-safe write, without a manual carry-over banner.

## Requirements

### Requirement: Eligible unfinished prior-period work carries into a new period automatically

A lead's eligible unfinished prior-period work MUST be carried forward into a new period
automatically when the lead's section for that period is established, with no
manual head action (head HF10). Carry-over MUST reuse the existing copy logic
(`CarryOverService.executeCarryOver` in
`apps/api/src/modules/carry-over/carry-over.service.ts`): an eligible item
(`type: "next"`, not already `carriedOver`, and `workflowStatus` is neither
`done` nor `postponed`) is cloned into the new section as a `current` item with
`carriedOver: true` and its `priorityRank` preserved; an unresolved decision (no
`resolvedAt`, carrying a `productId`) is cloned with `resolvedAt: null`. This
REVERSES the prior documented decision that "carry-over stays a conscious head
action" (the `CarryOverBanner` rationale). The existing write-integrity guard MUST
still hold: carry-over writes only into an editable target (period `open` or
`reopened`, not `archived`) and MUST NOT overwrite a `submitted` target section.
Carry-over MUST be idempotent: re-establishing the same section (for example a
second lead login, or a re-run) MUST NOT duplicate rows — enforced by the existing
per-section lineage key (`@@unique([reportSectionId, stableId])`) and the
`(sourceReportId, targetReportId)` execution dedupe. No new table or column is
introduced — the automatic path writes the same `CarryOverExecution` /
`CarryOverRecord` rows the manual path wrote.

#### Scenario: eligible unfinished work is carried without a head click

- **WHEN** a new period is opened and a lead — who had eligible unfinished next-week items
  and unresolved decisions in the prior period — has their new-period section
  established
- **THEN** those items appear in the new section as `carriedOver` current items
  with their priority rank preserved, and the unresolved decisions appear open
- **AND** no head action was required to move them

#### Scenario: no prior period carries nothing

- **WHEN** a lead's section is established on a period that has no prior period
- **THEN** nothing is carried and no error is raised

#### Scenario: finished prior work is not carried

- **WHEN** the prior-period section holds a next-week item with
  `workflowStatus: "done"`
- **THEN** that item is not carried into the new period

#### Scenario: postponed prior work is replanned manually

- **WHEN** the prior-period section holds a next-week item with
  `workflowStatus: "postponed"`
- **THEN** that item is not carried into the new period
- **AND** the lead can replan it manually when it becomes relevant

#### Scenario: re-establishing the section does not duplicate

- **WHEN** a lead's new-period section is established a second time (for example a
  second login) after carry-over already ran
- **THEN** no carried item or decision is duplicated in the section

#### Scenario: a submitted target is never overwritten

- **WHEN** the automatic carry-over would target a section that is already
  `submitted`, or a target period that is `published` or `archived`
- **THEN** carry-over does not write into it (the write-integrity guard rejects
  the non-editable target)

### Requirement: The manual carry-over banner is removed

The manual "Copy forward unfinished" banner MUST be removed from the head report
surface, because carry-over now runs automatically (head HF10). `CarryOverBanner`
(`apps/web/src/components/weekly-report/carry-over-banner.tsx`) and its mount in
`apps/web/src/features/report-pages/ui/weekly/weekly-report-page.tsx` MUST NOT render, so
the head is not shown a manual copy-forward action that duplicates the now
automatic behaviour.

#### Scenario: a newly opened period shows no manual banner

- **WHEN** a head opens a newly opened period whose leads had unfinished
  prior-period work
- **THEN** no "Copy forward unfinished" banner is shown
- **AND** the carried work is already present in the leads' sections

### Requirement: Concurrent carry-over executions resolve to one race-safe write

The carry-over write transaction MUST resolve two racing executions for the
same `(sourceReportId, targetReportId)` pair to a single race-safe write:
when the losing transaction's existence check finds a `CarryOverExecution`
row the winner already committed, it MUST return the winner's already-recorded
execution and records instead of attempting to insert records against an
execution id that was never committed. The write transaction MUST also
re-validate target-period editability (`periodStatus` is `open` or
`reopened`, and not `archived`) immediately before writing, not only from a
check performed before the transaction opened, so a period that transitions
to `published` or `archived` in the window between that earlier check and
the transaction's write is rejected rather than written into. The transaction
MUST lock, re-read, check, and write only target sections whose authors are
present in the planned carry-over entries. Unrelated target sections, including
submitted sections, MUST neither block the carry-over nor be mutated.

#### Scenario: the losing transaction returns the winner's rows

- **WHEN** two carry-over executions for the same source and target report
  race, and the second transaction's existence check finds a
  `CarryOverExecution` row the first transaction already committed
- **THEN** the second transaction does not attempt to insert
  `CarryOverRecord` rows against its own uncommitted execution id
- **AND** it returns the first transaction's already-recorded execution and
  records

#### Scenario: a period that stops being editable mid-race is rejected

- **WHEN** a carry-over transaction re-reads the target report's
  `periodStatus`/`archived` immediately before writing, and the period has
  become `published` or `archived` since the pre-transaction editability check
- **THEN** the transaction aborts without writing any execution, record, or
  carried item/decision row
- **AND** the caller receives a conflict error rather than a partially written
  state

#### Scenario: an unrelated submitted target does not block a planned carry-over

- **GIVEN** the target report has one planned author section and another
  submitted section for an author absent from the carry-over plan
- **WHEN** automatic or manual carry-over executes
- **THEN** the planned author's eligible rows are carried
- **AND** the unrelated submitted section remains unchanged and does not cause
  a conflict

#### Scenario: a submitted planned target still blocks

- **GIVEN** a target section belongs to an author present in the carry-over
  plan and is already `submitted`
- **WHEN** carry-over executes
- **THEN** the write is rejected with the canonical carry-over conflict
- **AND** no execution, record, or carried row is committed
