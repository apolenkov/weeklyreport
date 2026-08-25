## MODIFIED Requirements

### Requirement: Submit rejects writes on a published period

`submitSection` MUST reject the write when the section's report is archived or
its canonical `periodStatus` is not `"open"` or `"reopened"`. The application
precheck MUST apply this complete predicate before metadata lookup, validation,
and the destructive `saveSection` delete-recreate. The locked transaction gate
MUST independently apply the same predicate so a lifecycle change between the
precheck and mutation still fails closed. The already-submitted rejection stays
where it is (`validateSubmitInput`) and is NOT duplicated into this gate.

#### Scenario: Draft section of a published period cannot be submitted

- **WHEN** a lead submits a section that is still `draft` while its report
  `periodStatus` is `"published"` (for example a never-submitted lead within the
  grace window, or any section of a republished-after-reopen period)
- **THEN** `submitSection` rejects the call before metadata lookup, validation,
  or `saveSection` runs
- **AND** the section's live `item` / `risk` / `decision` rows are left unchanged

#### Scenario: Archived editable-status section cannot be submitted

- **WHEN** a lead submits a draft section whose report is archived while its
  `periodStatus` still reads `"open"` or `"reopened"`
- **THEN** `submitSection` rejects the call at the application precheck before
  metadata lookup, validation, or mutation

#### Scenario: Submit succeeds on an editable period

- **WHEN** a lead submits a valid `draft` section whose report is not archived
  and whose `periodStatus` is `"open"` or `"reopened"`
- **THEN** `submitSection` proceeds through the existing validation and persists
  the submitted section

### Requirement: Both write paths read one shared period-status lookup

Both `saveDraft` and `submitSection` MUST obtain the canonical lifecycle facts
through one section-keyed lookup on the `ReportSectionsRepository` port. The
lookup MUST return both `periodStatus` and `archived`, or `null` when the owning
tuple cannot be resolved. Neither write path may re-derive editability or read
the legacy `Report.status` column. Automated coverage MUST assert reopened,
published, and archived behavior.

#### Scenario: Write paths do not consult the legacy status column

- **WHEN** the `saveDraft` and `submitSection` application gates are inspected
- **THEN** each reads `periodStatus` and `archived` via the shared section-keyed
  lookup
- **AND** neither decides editability from `getReportStatus` or the legacy
  `Report.status` column

#### Scenario: Automated tests pin the two behaviors

- **WHEN** the report-sections test suite runs
- **THEN** at least one test asserts that a draft save on a non-archived
  `reopened` period succeeds even though the legacy status is `"published"`
- **AND** tests assert that archived `open` and archived `reopened` periods are
  rejected before later submit work or mutation
