# admin-assignment-group-integrity Specification

## Purpose

Defines how Admin writes keep project-activity group moves, report assignments, the last active reporting group and product ownership consistent.

## Requirements

### Requirement: Project-activity group moves and lead attachments preserve group equality atomically

The `projectActivity` update and `attachLead` repository operations MUST validate the activity group, every attached lead group, and the requested mutation within one serializable transaction or an equivalent database-enforced atomic command.

#### Scenario: Attach races with a group move

- **WHEN** lead attachment validates the old group while a concurrent transaction moves the activity
- **THEN** at most one transaction commits and the final database contains no cross-group attachment

#### Scenario: Group move races with an attachment

- **WHEN** a group move validates the existing lead set while a concurrent transaction attaches a lead from the old group
- **THEN** at most one transaction commits and the losing operation returns a typed retryable conflict

#### Scenario: Matching groups remain valid

- **WHEN** the activity and lead remain in the same group for the complete transaction
- **THEN** attachment or group movement commits once without changing unrelated edges

### Requirement: Assignment writes reconcile only live editable report rows

Project-activity lead attachment/detachment and product lead assignment MUST
reconcile their per-section status rows in the same transaction as the
assignment. The transaction MUST lock affected parent reports in deterministic
id order and re-check the complete editable lifecycle after each lock. An
attachment or assignment MUST backfill a missing status row for an existing
editable section; detachment or reassignment MUST remove only the outgoing
owner's status rows from editable sections. Published, archived, and otherwise
closed sections are immutable and MUST remain byte-identical. A later section
provisioning write remains responsible for materializing a row when the
assignment commits before the section is created.

Every writer of the assignment/status graph, including section provisioning,
section saves, activity attachment/detachment, targeted product assignment,
and snapshot restore, MUST first acquire the shared transaction-scoped status
graph serialization boundary. This boundary MUST cover the candidate-report
scan and all derived status writes, so a report committed after a scan cannot
be provisioned with an obsolete owner or activity edge. The MVP MAY implement
this as one PostgreSQL transaction-scoped advisory lock; a narrower key is
allowed only when every report-creation and status-seeding path is covered.

#### Scenario: Attaching a lead backfills an existing editable section

- **GIVEN** an editable report section already exists for a lead and an
  activity is not yet attached to that lead
- **WHEN** the activity is attached
- **THEN** the activity edge and one empty `ActivityStatus` row commit together
- **AND** the row is visible immediately without recreating the section

#### Scenario: Detaching cannot delete a published activity status

- **GIVEN** the lead has activity statuses in both an editable section and a
  published section
- **WHEN** the activity is detached
- **THEN** only the editable status row is removed
- **AND** the published status and its snapshot remain unchanged

#### Scenario: Reassigning a product reconciles live owners

- **GIVEN** an editable section for the old product lead and an editable
  section for the new product lead
- **WHEN** an administrator changes the product's lead
- **THEN** the old lead's `ProjectStatus` row is removed and the new lead's row
  is materialized with an empty status
- **AND** statuses in published or archived sections are untouched

#### Scenario: A report created after an assignment scan cannot receive stale statuses

- **GIVEN** a product assignment transaction has acquired the shared status
  graph boundary and scanned editable reports
- **WHEN** a new editable report is committed before a lead section is first
  provisioned for it
- **THEN** provisioning waits for the assignment transaction's boundary
- **AND** the new section's project and activity statuses reflect the
  committed assignment graph, not the pre-scan graph

### Requirement: The last active reporting group cannot be archived

The targeted admin catalog mutations `admin.archiveReportingGroup` and `admin.saveReportingGroup` MUST reject an active-to-archived transition for the last active `ReportingGroup` with `CONFLICT` and a fixed safe message. The decision and write MUST be atomic under competing requests: concurrent attempts to archive the last two active groups MUST leave at least one active group. An archive request for a missing target MUST retain `NOT_FOUND`, and an already-archived target MUST remain idempotent. Existing input and head validation precedence MUST be preserved. Rename and other non-archiving edits, restoration of an archived group, and creation of a new archived group MUST remain available.

The admin Groups edit dialog MUST prevent checking Archived for the last active group based on the global group roster, independently of search/archive filters, with a visible explanation. The restriction MUST NOT disable rename or restoration. The server MUST still enforce the invariant when the client roster is stale.

#### Scenario: The direct archive request targets the last active group

- **GIVEN** exactly one active reporting group exists
- **WHEN** an administrator calls `admin.archiveReportingGroup` for that group
- **THEN** the call fails with `CONFLICT` and the group remains active

#### Scenario: The edit-form save attempts to archive the last active group

- **GIVEN** exactly one active reporting group exists and its other input values are valid
- **WHEN** an administrator calls `admin.saveReportingGroup` with that group's id and `archived: true`
- **THEN** the call fails with `CONFLICT` and the persisted row is unchanged

#### Scenario: Concurrent catalog writes target the last two groups

- **GIVEN** exactly two active reporting groups exist
- **WHEN** two requests concurrently archive different groups through either catalog mutation
- **THEN** one request succeeds and the other fails with `CONFLICT`, leaving one active group

#### Scenario: Another active group exists outside the filtered table

- **GIVEN** two active groups exist and the search filter displays only one
- **WHEN** the displayed group is edited
- **THEN** its Archived checkbox remains available, and archiving it leaves the other group active

#### Scenario: The last active group's name is edited

- **GIVEN** exactly one active group exists
- **WHEN** its edit dialog opens and a valid new name is saved with `archived: false`
- **THEN** Archived cannot be checked, its explanation is visible, and the rename succeeds

#### Scenario: An archived group is restored

- **GIVEN** an archived group exists alongside exactly one active group
- **WHEN** the archived group's checkbox is cleared and the edit is saved
- **THEN** restoration succeeds and two active groups exist

#### Scenario: Non-transitions preserve their current semantics

- **WHEN** archive targets a missing group, repeats on an already-archived group, or save creates a new archived group
- **THEN** the missing archive retains `NOT_FOUND`, the repeated archive succeeds, and creation succeeds without reducing the active count

### Requirement: Product ownership changes require an active desired lead

`admin.saveProject` MUST reject a new product or changed owner whose desired User has `isActive=false`, with `AdminGroupProductConflictError` mapped to `CONFLICT`, before assignment writes. An unchanged inactive lead MUST remain eligible for rename and targeted archived-product Restore, without modifying User activity. Existing role, reporting-group, lock ordering, and concurrent-owner checks MUST remain effective. This requirement does not change bulk snapshot restore's whole-graph contract.

#### Scenario: Assigning an existing product to a deactivated lead

- **GIVEN** a product currently belongs to a different lead and the desired user is an inactive lead in the otherwise valid reporting group
- **WHEN** `admin.saveProject` requests that ownership change
- **THEN** it returns `CONFLICT` through `AdminGroupProductConflictError`
- **AND** the Project, derived ProjectStatus rows, and desired User remain unchanged

#### Scenario: Creating a product for a deactivated lead

- **WHEN** `admin.saveProject` creates a product whose desired user is an inactive lead
- **THEN** it returns the same typed conflict and creates no product or derived status

#### Scenario: Renaming with an unchanged inactive owner

- **GIVEN** a product's current owner is an inactive lead and all existing role/group constraints remain valid
- **WHEN** the administrator renames the product with the same leadId
- **THEN** the rename succeeds and the user remains inactive

#### Scenario: Targeted Restore retains an inactive owner

- **GIVEN** an archived product has an inactive current lead
- **WHEN** ProductsTab requests targeted Restore with the same leadId and archived=false
- **THEN** the product becomes active with its existing lead, and the User is not reactivated

#### Scenario: Active new ownership remains admissible

- **WHEN** a product is created or reassigned to an active lead and existing integrity constraints are satisfied
- **THEN** the targeted assignment proceeds with the existing live-status reconciliation

#### Scenario: Concurrent ownership change preserves the earlier conflict

- **GIVEN** ownership changes between the stable-user lock candidate read and the locked project reread
- **WHEN** the requested desired lead is also inactive
- **THEN** the existing concurrent-ownership conflict takes precedence over desired-lead activity refusal

#### Scenario: Group attach keeps its current owner

- **GIVEN** the product's current owner is an inactive lead in the compatible reporting group
- **WHEN** `admin.attachProductToGroup` retains that current owner
- **THEN** inactivity alone does not block attachment and existing group/ownership checks still apply
