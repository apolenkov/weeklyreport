# report-section-write-gates Specification

## Purpose

Define the server-side editability gates for the two lead-section write paths,
`saveDraft` and `submitSection`, in
`apps/api/src/modules/report-sections/`. Both paths MUST decide editability from
the canonical `periodStatus` of the section's report, never from the legacy
`Report.status` column, so that reopen editing works and the published read-only
lock cannot be bypassed on the submit path.

## ADDED Requirements

### Requirement: Draft saves gate on canonical period status

`saveDraft` MUST decide editability from the section's canonical `periodStatus`,
never from the legacy `Report.status` column. It MUST reject the write only when
`periodStatus === "published"`, and MUST allow the write when the period is
`"open"` or `"reopened"`. The existing `section.status === "submitted"` read-only
rejection MUST remain in force, so an individual submitted section stays locked
even on an editable period.

#### Scenario: Reopened period accepts a draft save

- **WHEN** a lead autosaves a draft on a section whose report `periodStatus` is
  `"reopened"` (its legacy `Report.status` column still reads `"published"`
  because the reopen transition leaves the legacy tuple untouched)
- **THEN** `saveDraft` persists the draft and does not throw
  `SECTION_ALREADY_SUBMITTED`

#### Scenario: Published period rejects a draft save

- **WHEN** a lead attempts a draft save on a section whose report `periodStatus`
  is `"published"`
- **THEN** `saveDraft` rejects with `SECTION_ALREADY_SUBMITTED` and writes nothing

#### Scenario: Open period accepts a draft save

- **WHEN** a lead autosaves a draft on a section whose report `periodStatus` is
  `"open"`
- **THEN** `saveDraft` persists the draft

### Requirement: Submit rejects writes on a published period

`submitSection` MUST reject the write when the section's report `periodStatus` is
`"published"`, applying the check before the destructive `saveSection`
delete-recreate. This closes the case of a section still in `draft` inside a
published report — which occurs systematically for every section of a
reopen-then-republished period, since publishing does not flip section statuses.
The already-submitted rejection stays where it is (`validateSubmitInput`) and is
NOT duplicated into this gate.

#### Scenario: Draft section of a published period cannot be submitted

- **WHEN** a lead submits a section that is still `draft` while its report
  `periodStatus` is `"published"` (for example a never-submitted lead within the
  grace window, or any section of a republished-after-reopen period)
- **THEN** `submitSection` rejects the call before `saveSection` runs, and the
  section's live `item` / `risk` / `decision` rows are left unchanged, so they do
  not diverge from the frozen `publishedSnapshot`

#### Scenario: Submit succeeds on an editable period

- **WHEN** a lead submits a valid `draft` section whose report `periodStatus` is
  `"open"` or `"reopened"`
- **THEN** `submitSection` proceeds through the existing validation and persists
  the submitted section

### Requirement: Both write paths read one shared period-status lookup

Both `saveDraft` and `submitSection` MUST obtain `periodStatus` through a single
section-keyed lookup on the `ReportSectionsRepository` port, mirroring the
existing `getReportPeriodStatusForSection` shape the lead-form path uses, rather
than each re-deriving the value or reading the legacy status column. Automated
coverage MUST assert both the reopened-autosave and published-submit behaviors.

#### Scenario: Write paths do not consult the legacy status column

- **WHEN** the `saveDraft` and `submitSection` gates are inspected
- **THEN** each reads `periodStatus` via the shared section-keyed lookup
- **AND** neither decides editability from `getReportStatus` / the legacy
  `Report.status` column

#### Scenario: Automated tests pin the two behaviors

- **WHEN** the report-sections test suite runs
- **THEN** at least one test asserts that a draft save on a `reopened` period
  succeeds even though the legacy status column reads `"published"`
- **AND** at least one test asserts that a submit against a `draft` section of a
  `published` period is rejected and leaves its child rows unchanged
