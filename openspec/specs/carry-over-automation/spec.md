# carry-over-automation Specification

## Purpose

TBD - created by syncing change lead-report-surface-polish. Update Purpose after archive.

## Requirements

### Requirement: Unfinished prior-period work carries into a new period automatically

A lead's unfinished prior-period work MUST be carried forward into a new period
automatically when the lead's section for that period is established, with no
manual head action (head HF10). Carry-over MUST reuse the existing copy logic
(`CarryOverService.executeCarryOver` in
`apps/api/src/modules/carry-over/carry-over.service.ts`): an unfinished item
(`type: "next"`, not already `carriedOver`, `workflowStatus !== "done"`, not
`completed`) is cloned into the new section as a `current` item with
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

#### Scenario: unfinished work is carried without a head click

- **WHEN** a new period is opened and a lead — who had unfinished next-week items
  and unresolved decisions in the prior period — has their new-period section
  established
- **THEN** those items appear in the new section as `carriedOver` current items
  with their priority rank preserved, and the unresolved decisions appear open
- **AND** no head action was required to move them

#### Scenario: no prior period carries nothing

- **WHEN** a lead's section is established on a period that has no prior period
- **THEN** nothing is carried and no error is raised

#### Scenario: finished prior work is not carried

- **WHEN** the prior-period section holds a next-week item that is `completed` or
  `workflowStatus: "done"`
- **THEN** that item is not carried into the new period

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
`apps/web/src/components/weekly-report/weekly-report-page.tsx` MUST NOT render, so
the head is not shown a manual copy-forward action that duplicates the now
automatic behaviour.

#### Scenario: a newly opened period shows no manual banner

- **WHEN** a head opens a newly opened period whose leads had unfinished
  prior-period work
- **THEN** no "Copy forward unfinished" banner is shown
- **AND** the carried work is already present in the leads' sections
