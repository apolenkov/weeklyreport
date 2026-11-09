## MODIFIED Requirements

### Requirement: Submit rejects writes on a published period

`submitSection` MUST reject the write when the section's report is archived or
its canonical `periodStatus` is not `"open"` or `"reopened"`. The application
precheck MUST apply this complete predicate before metadata lookup, validation,
and the destructive `saveSection` delete-recreate. The locked transaction gate
MUST independently apply the same predicate so a lifecycle change between the
precheck and mutation still fails closed. The already-submitted rejection stays
where it is (`validateSubmitInput`) and is NOT duplicated into this gate.

Under the report lock and section-version compare-and-set, `submitSection` MUST validate the authoritative resulting risk and decision collection, including persisted incomplete rows omitted by replacement, before child clearing. It MUST reject incomplete rows with actionable field guidance without committing any change to the section, version or children; a provisional transactional version increment MUST roll back on rejection. Explicit identity-targeted deletion is allowed; mere omission, including by old clients, MUST reject the write without committed mutation. Existing authorization, ownership, identity, lineage and other validation remain in force.

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

#### Scenario: Persisted incomplete row is omitted by an old client

- **WHEN** an old client submits a replacement omitting a persisted incomplete risk or decision without explicit deletion
- **THEN** submission rejects the request without committed mutation and cannot submit an incomplete authoritative collection

#### Scenario: Explicit deletion precedes strict submission

- **WHEN** an authorized author explicitly deletes an incomplete record by identity under the current section version and all remaining submission requirements are satisfied
- **THEN** submission can proceed without deleting unrelated records or comments

#### Scenario: Incomplete resulting collection fails atomically

- **WHEN** a current-version submission leaves an incomplete risk or decision in the authoritative resulting collection
- **THEN** submission returns actionable missing-field guidance and changes no section, version or child rows

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

`saveDraft` MUST reject a replacement collection that omits a persisted incomplete risk or decision, without committed mutation, unless the authorized author explicitly deletes that identity. This applies to older clients and autosaves as well as current clients. The existing section-version compare-and-set, ownership, stable identity, comments and published-lineage protections remain in force. Valid minimal risk and decision drafts retain eligible parent and stages, primary text, explicit risk severity or authoritative decision owner; missing detail is null rather than fabricated.

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

#### Scenario: Old client replacement omits an incomplete record

- **WHEN** an old client saves a replacement omitting a persisted incomplete risk or decision without explicit deletion
- **THEN** the entire write is rejected without committed mutation
- **AND** unrelated identities and comments are preserved

#### Scenario: Author explicitly deletes an incomplete record

- **WHEN** the authorized author deletes the incomplete record by identity using the current section version
- **THEN** only the intended record is deleted and unrelated records and comments remain intact

#### Scenario: Minimal decision draft saves without invented details

- **WHEN** a decision has valid primary text, eligible parent and stages, and its authoritative owner, but no impact
- **THEN** a successful draft save stores null impact and identifies the record as incomplete

## ADDED Requirements

### Requirement: Incomplete replacement deletion requires explicit intent

Every collection-replacement writer MUST reject omission of a persisted incomplete risk or decision unless the request explicitly deletes its kind and stableId at the expected section version. Present-and-delete, duplicate, foreign or nonexistent deletion identities MUST fail atomically. Existing published-lineage protection still forbids deletion where applicable. An old client without deletion intent MUST fail safely, not delete by omission.

#### Scenario: Filtered autosave or fill-from drops a draft

- **WHEN** autosave, submit, fill-from or another replacement writer would omit a stored incomplete row without explicit deletion
- **THEN** the transaction rejects before child clearing and leaves version, rows and comments unchanged
- **AND** the author receives guidance to reload, complete or explicitly delete the draft

#### Scenario: Deletion intent conflicts with content

- **WHEN** the same kind/stableId appears both in the replacement and deletion list, or a deletion names a different section's row
- **THEN** the whole request is rejected without mutation

#### Scenario: Completion is not deletion

- **WHEN** a persisted incomplete row is supplied complete with the same stableId and a current section version
- **THEN** the save preserves its lineage and comments while making it complete

#### Scenario: Published decision cannot become incomplete on reopen

- **WHEN** an author clears impact on a previously published decision in an editable reopened period
- **THEN** the locked lineage recheck rejects the whole write with `PUBLISHED_RECORD_LOCKED` before version CAS or child clearing
- **AND** guidance identifies Impact and asks the author to restore it or supply a valid replacement; the durable decision, comments and snapshot remain unchanged

### Requirement: Published decisions retain complete content

Save and submit MUST reject a replacement that makes a published decision incomplete, using `PUBLISHED_RECORD_LOCKED` after the authoritative locked lineage recheck. Explicit deletion intent MUST NOT bypass this guard. Guidance MUST identify the missing detail without inventing it. This restriction does not add published-lineage protection to risks or change item behavior.

#### Scenario: Sole publication witness survives republish

- **GIVEN** decision D appears only in publication P1 and in no other report
- **WHEN** P1 is reopened and a save attempts to clear D's impact
- **THEN** the save rejects without changing version, records or comments
- **WHEN** the unchanged complete D is republished in P2, the report is reopened again and D is deleted
- **THEN** deletion rejects with `PUBLISHED_RECORD_LOCKED`, including after search projection rebuild and lineage cache reset
- **AND** P2 still contains complete D without a new publication-history store or public identity metadata

#### Scenario: Never-published decision may become incomplete

- **WHEN** an otherwise valid save clears impact on a decision absent from all published lineage sources
- **THEN** it may persist as incomplete under the same stableId with its comments intact
- **AND** later omission requires explicit incomplete-record deletion intent
