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

### Requirement: Section writes admit only a proven editable period tuple

`saveDraft` and `submitSection` MUST prove inside their write transaction that the owning report still has a complete consistent editable lifecycle tuple. Open and reopened are the only accepted period statuses; null, missing, deleted, published, archived, or contradictory state MUST fail closed.

#### Scenario: Period status lookup returns null

- **WHEN** either section write path cannot resolve a complete owning report lifecycle tuple
- **THEN** it rejects before deleting or recreating child rows and returns the typed not-found or integrity error

#### Scenario: Period changes while a section write is pending

- **WHEN** archive, publish, reopen, or deletion commits after an application pre-check but before the section mutation
- **THEN** the transaction predicate no longer matches, the entire section mutation rolls back, and a typed stale/lifecycle error is returned

#### Scenario: Reopened period remains editable

- **WHEN** the owning report has one complete reopened tuple throughout the transaction
- **THEN** draft save or submit applies atomically and preserves the period tuple unchanged
