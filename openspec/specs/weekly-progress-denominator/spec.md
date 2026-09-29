# weekly-progress-denominator Specification

## Purpose

Give Head and Admin one weekly submission-progress figure by computing it once
over the period's expected leads.

## Requirements

### Requirement: Weekly progress uses one denominator for Head and Admin

The weekly read model's `submissionCount` and `totalLeads` SHALL be computed by one shared function over the period's expected leads. For an editable period the expected leads are the users with `role = lead` and `isActive = true`; for a published period they are the authors frozen in the publication snapshot. Head and Admin SHALL use every reporting group, so both see the same figure for the same period. Lead and Viewer roles SHALL keep their group scope so counts never include groups outside their access. Each expected lead SHALL count once, and only expected leads SHALL count as submitted.

#### Scenario: Head and Admin see the same progress

- **GIVEN** ten active leads across two groups, three of whom have submitted, and a Head scoped to a group of eight
- **WHEN** the Head and the Admin read the same period
- **THEN** both receive `submissionCount` 3 and `totalLeads` 10

#### Scenario: A deactivated lead is not expected

- **GIVEN** a deactivated lead with no submission
- **WHEN** the live weekly read model is built
- **THEN** that lead is not part of `totalLeads`

#### Scenario: A restricted viewer stays inside its groups

- **GIVEN** a Viewer whose access covers one group
- **WHEN** the Viewer reads the weekly report
- **THEN** `totalLeads` counts only leads of that group
