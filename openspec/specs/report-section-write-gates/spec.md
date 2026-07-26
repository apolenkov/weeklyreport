# report-section-write-gates Specification

## Purpose

Define the server-side editability gates for the two lead-section write paths,
`saveDraft` and `submitSection`, in
`apps/api/src/modules/report-sections/`. Both paths MUST decide editability from
the canonical `periodStatus` of the section's report, never from the legacy
`Report.status` column, so that reopen editing works and the published read-only
lock cannot be bypassed on the submit path.

## Requirements

### Requirement: Draft saves gate on canonical period status

`saveDraft` MUST decide editability from the section's canonical `periodStatus`,
never from the legacy `Report.status` column. It MUST reject the write when
`periodStatus === "published"` and MUST allow it when the period is `"open"` or
`"reopened"` AND the report is not archived. The existing
`section.status === "submitted"` read-only rejection MUST remain in force, so an
individual submitted section stays locked even on an editable period.

Archiving does NOT change `periodStatus`, so a gate reading that column alone
admits an archive that commits between the service-level precheck and the write
transaction. Every write gate MUST therefore evaluate the same predicate as
`isEditablePeriod` (`review-authz.ts`): not archived, and status `"open"` or
`"reopened"`. This binds the in-transaction `FOR UPDATE` gates in
`save-section.transaction.ts`, `fill-from.transaction.ts` and
`review-actions.verdict-write.ts` alike — they are one contract in three
places, and two of the three carried the archived term while this text still
said "only when published".

A gate that reads no row at all is a different case: the row it locks was
deleted inside the same window — the parent `Report` for the save gate, the
section-joined row for `fill-from` and the verdict gate. Each MUST separate that
from the period-state rejection and raise a not-found-class error, which the
tRPC mapper surfaces as `NOT_FOUND`. `saveDraft` and `submitSection` raise
`ReportSectionNotFoundError`; a period-state constraint stays
`ReportSectionDomainError("SECTION_ALREADY_SUBMITTED")` → `BAD_REQUEST`. A save
whose SECTION (not report) vanished is caught downstream by the version
compare-and-set and stays `SectionVersionConflictError` → `CONFLICT`.

#### Scenario: An archive committing inside the write window rejects the save

- **WHEN** an admin archives a report after `saveDraft`'s service-level
  precheck has passed and before its write transaction takes the row lock, so
  the locked row reads `periodStatus: "open"` with `archived: true`
- **THEN** the in-transaction gate rejects the write before any child row is
  deleted, and the caller sees the published-period constraint error rather
  than a partially rewritten section

#### Scenario: A report deleted inside the write window is NOT_FOUND

- **WHEN** the report is deleted after `saveDraft`'s service-level precheck has
  passed and before its write transaction takes the row lock, so the locking
  read returns no gate row at all
- **THEN** the write is rejected before any child row is deleted with
  `ReportSectionNotFoundError`, which the tRPC error mapper turns into
  `NOT_FOUND` — not the `SECTION_ALREADY_SUBMITTED` period-state constraint,
  which would tell the client a live report is published

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
