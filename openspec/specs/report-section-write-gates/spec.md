# report-section-write-gates Specification

## Purpose

Define the server-side editability gate shared by lead-section provisioning,
save, fill, review, revoke, and reopen-request writes. Every mutation MUST lock
the parent report first and admit only a complete canonical editable lifecycle,
so reopened reports remain writable while publish and archive transitions close
all section-write races.

## Requirements

### Requirement: Draft saves gate on canonical period status

`saveDraft` MUST decide editability from the section's canonical `periodStatus`,
never from the companion `Report.status` column. It MUST reject the write when
`periodStatus === "published"` and MUST allow it when the period is `"open"` or
`"reopened"` AND the report is not archived. The existing
`section.status === "submitted"` read-only rejection MUST remain in force, so an
individual submitted section stays locked even on an editable period.

Archiving does NOT change `periodStatus`, so a gate reading that column alone
admits an archive that commits between the service-level precheck and the write
transaction. Every write gate MUST therefore evaluate the same predicate as
`isEditablePeriod` (`review-authz.ts`): not archived, and status `"open"` or
`"reopened"`. This binds every in-transaction `FOR UPDATE` gate in
provisioning, save, fill, review, revoke, and reopen-request paths. Those paths
MUST call one shared parent-report lock helper rather than copy lifecycle SQL or
predicates.

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
  `"reopened"` (its companion `Report.status` column still reads `"published"`
  because the reopen transition leaves the companion publication fields unchanged)
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
the companion `Report.status` column. Automated coverage MUST assert reopened,
published, and archived behavior.

#### Scenario: Write paths do not consult the companion publication status column

- **WHEN** the `saveDraft` and `submitSection` application gates are inspected
- **THEN** each reads `periodStatus` and `archived` via the shared section-keyed
  lookup
- **AND** neither decides editability from the companion `Report.status` column

#### Scenario: Automated tests pin the two behaviors

- **WHEN** the report-sections test suite runs
- **THEN** at least one test asserts that a draft save on a non-archived
  `reopened` period succeeds even though the companion publication status is `"published"`
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
- **THEN** draft save or submit applies atomically and preserves the lifecycle tuple unchanged

### Requirement: Revoke rechecks archive and editable-period state in the write

The individual `leadForm.revoke` and bulk `leadForm.revokeAllSubmitted` tRPC
procedures MUST lock the parent report first inside the mutation transaction and
persist their section-state transition only when the complete lifecycle tuple is
exactly draft/open or published/reopened and not archived. Group scope and the
submitted-state compare-and-set remain defense-in-depth; a prior application
read or relation predicate MUST NOT authorize a later write after the report is
archived or leaves an editable state.

#### Scenario: Archive wins against revoke

- **WHEN** a report becomes archived after `leadForm.revoke` or
  `leadForm.revokeAllSubmitted` begins but before its write commits
- **THEN** no report section is changed
- **AND** the request returns the canonical lifecycle conflict or a zero bulk count

#### Scenario: Submitted section remains editable

- **WHEN** a submitted section belongs to a non-archived report whose canonical
  status is `"open"` or `"reopened"`
- **THEN** an authorized revoke may return it to the permitted editable state

### Requirement: Section provisioning locks the parent lifecycle

`ensureLeadSection` MUST run the existing-section lookup and any creation in one
transaction that first locks the parent `Report` through the shared lifecycle
gate. An existing section MUST NOT be returned as an active workspace after its
report became published, archived, scheduled, deleted, or contradictory. A
caller that races a lifecycle transition MAY re-resolve the current period, but
MUST NOT fall back to provisioning the stale report.

#### Scenario: Publish wins before section provisioning

- **WHEN** the target report is published before `ensureLeadSection` acquires
  its parent lock, whether or not the section row already exists
- **THEN** provisioning rejects before returning or creating the section
- **AND** a workspace caller re-resolves the current report once or propagates
  the typed stale lifecycle result

#### Scenario: Open report admits existing and new sections

- **WHEN** the parent report keeps one complete draft/open lifecycle throughout
  the transaction
- **THEN** provisioning may return the existing lead section or create and seed
  one new section atomically
