# weekly-progress-denominator Specification

## Purpose

Give Head and Admin one weekly submission-progress figure, on the weekly report and in the Admin Periods tab, by computing it once
over the period's expected leads.

## Requirements

### Requirement: Weekly progress uses one denominator for Head and Admin

The weekly read model's `submissionCount` and `totalLeads` SHALL be computed by one shared function over the period's expected leads. For an editable period the expected leads are the users with `role = lead` and `isActive = true`; for a published period they are the authors frozen in the publication snapshot. Head and Admin SHALL use every reporting group, so both see the same figure for the same period. Head progress is a deliberate cross-group read tied to the Head's cross-group lifecycle (publish) authority (see `group-scope-isolation-gaps`), and it exposes counts only, never sections of other groups. Lead and Viewer roles SHALL keep their group scope, as `group-scope-isolation-gaps` requires, so counts never include groups outside their access. Each expected lead SHALL count once, and only expected leads SHALL count as submitted. The Admin Periods tab SHALL report `submittedCount` and `totalCount` with the same shared function and expected-lead rules (org-wide, as Admin), never by counting section rows.

#### Scenario: Head and Admin see the same progress

- **GIVEN** ten active leads across two groups, three of whom have submitted, and a Head scoped to a group of eight
- **WHEN** the Head and the Admin read the same period
- **THEN** both receive `submissionCount` 3 and `totalLeads` 10

#### Scenario: A deactivated lead is not expected

- **GIVEN** a deactivated lead with no submission
- **WHEN** the live weekly read model is built
- **THEN** that lead is not part of `totalLeads`, and their submitted section, if any, is not counted in `submissionCount`

#### Scenario: A restricted viewer stays inside its groups

- **GIVEN** a Viewer whose access covers one group
- **WHEN** the Viewer reads the weekly report
- **THEN** `totalLeads` counts only leads of that group

#### Scenario: Admin Periods matches the lead-based figure

- **GIVEN** an open period with two active leads, one of whom submitted, plus a deactivated lead whose section is also submitted
- **WHEN** the Admin lists periods
- **THEN** the period row has `submittedCount` 1 and `totalCount` 2, and a published period reports the authors frozen in its snapshot

#### Scenario: A Head PDF header matches the interface

- **GIVEN** a published period with nine submitted leads across several groups and a Head whose PDF job snapshot is scoped to seven of them
- **WHEN** the Head's PDF is rendered
- **THEN** its header shows the org-wide figure frozen into the job (9/9), while its sections stay inside the Head's groups

### Requirement: Admin Periods progress groups section rows once

The Admin Periods tab SHALL compute each open period's `submittedCount` and `totalCount` from that period's own section rows, grouped in a single pass over the fetched section rows. Its cost SHALL grow with the number of open periods plus the number of section rows, not with their product. The figure for each period SHALL stay identical to the shared lead-based computation, including the deactivated-lead, duplicate-row and out-of-scope rules.

#### Scenario: Several open periods share one pass over their sections

- **GIVEN** three open periods, each with its own section rows, and a section row for a period that is not listed
- **WHEN** the Admin lists the periods
- **THEN** each row's `submittedCount` and `totalCount` equal the lead-based figure for that period's own sections, and the section rows are not rescanned once per period
