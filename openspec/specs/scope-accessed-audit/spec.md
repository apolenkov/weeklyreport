# scope-accessed-audit Specification

## Purpose

Define the access-side audit event that records when a non-admin caller's
weekly-report read legitimately surfaces a product belonging to another
group through the explicit `GroupProduct` join. Closes the audit-trail
asymmetry where `scopeDenied` logs the deny path but no event logs the
granted cross-group access.

Consumer surfaces: the `AuditLogger.scopeAccessed` method
(`apps/api/src/lib/audit-logger.ts`, type in
`apps/api/src/lib/audit-logger-types.ts`); the `weeklyReport.get` procedure in
`apps/api/src/infrastructure/trpc/routers/weekly-report.router.ts`; and the
weekly-report read in
`apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`.

## Requirements

### Requirement: AuditLogger Exposes a scopeAccessed Event

The `AuditLogger` interface MUST expose a `scopeAccessed` method that
records a granted cross-group product read. The real logger MUST emit it
at `info` level (granted access is normal traffic, unlike `scopeDenied`
which stays at `warn`). The no-op logger MUST implement it as a silent
no-op for callers that do not configure audit output.

The payload MUST be whitelisted at the type level — it carries the
caller (`userId`, `role`, `ip`), the surfaced cross-group `productIds`
and `groupIds`, the `resourceId` (report id), and an `accessedScope`
route marker. It MUST NOT carry row contents, section text, or any field
outside the typed input.

#### Scenario: Real logger emits the event at info

- **WHEN** `scopeAccessed` is called with a whitelisted payload
- **THEN** the AppLogger receives one `info` line with `event: "scope-accessed"` and the payload fields
- **AND** no field outside the typed input appears on the line

#### Scenario: No-op logger stays silent

- **WHEN** the no-op logger's `scopeAccessed` is called
- **THEN** nothing is written and no error is thrown

### Requirement: Cross-Group Weekly-Report Read Emits scopeAccessed Once

A weekly-report read MUST emit exactly one `scopeAccessed` event when a
non-admin caller surfaces at least one cross-group product, and MUST NOT
emit more than one event per request regardless of how many cross-group
products surface. A product is cross-group when its natural owner group
(the product lead's `reportingGroupId`) is NOT in the caller's allowed
group ids, yet the product surfaces via the explicit `GroupProduct` join.

The event MUST be emitted at the `weeklyReport.get` query where the
caller's `ip`, `userId`, and `role` are available, mirroring the
`scopeDenied` callsites. The emitted payload's `productIds` and
`groupIds` MUST list the distinct surfaced cross-group ids.

#### Scenario: Non-admin surfaces a cross-group product

- **WHEN** a head or viewer reads a weekly report and a product joined from another group surfaces
- **THEN** exactly one `scopeAccessed` event is emitted
- **AND** its `productIds` includes the cross-group product and `resourceId` is the report id

#### Scenario: Multiple cross-group products in one read

- **WHEN** a single read surfaces two cross-group products
- **THEN** exactly one `scopeAccessed` event is emitted, not two
- **AND** its `productIds` lists both product ids

### Requirement: Same-Group and Admin Reads Emit No scopeAccessed Event

A weekly-report read MUST NOT emit `scopeAccessed` when every surfaced
product belongs to the caller's own group, and MUST NOT emit it for
admin callers. Admin sessions carry no scope filter, so an admin read is
never a cross-group access. A product the caller naturally owns MUST NOT
count as cross-group even if it is also joined to another group.

#### Scenario: Caller sees only own-group products

- **WHEN** a non-admin read surfaces only products whose owner group is the caller's own group
- **THEN** no `scopeAccessed` event is emitted

#### Scenario: Admin read

- **WHEN** an admin reads a weekly report
- **THEN** no `scopeAccessed` event is emitted

#### Scenario: Product owned by caller's group and also joined elsewhere

- **WHEN** a surfaced product's natural owner is the caller's own group but it also has a GroupProduct edge to another group
- **THEN** the product does not count as cross-group and no event is emitted for it

### Requirement: scopeAccessed Does Not Alter the Returned Data

The read MUST return the same scoped result set whether or not the
`scopeAccessed` event fires. The event is observability only and MUST NOT
add, remove, or reorder any product, section, or escalation in the read
model. The cross-group detection MUST NOT widen the query beyond the
existing scope filter.

#### Scenario: Read model is identical with and without the event

- **WHEN** the same read is run with audit emission enabled and with a no-op logger
- **THEN** the returned weekly-report read model is byte-for-byte identical in both cases

### Requirement: Published-Snapshot Reads Detect Cross-Group From Frozen Owner-Group Data

A published-report read MUST compute the cross-group audit signal from
the products actually surfaced in the frozen `publishedSnapshot`, using
each product's owner group as frozen into the snapshot at publish time,
and MUST NOT derive it by intersecting the snapshot-surfaced product ids
with a live re-query of current, non-archived projects and their current
`GroupProduct` edges. A product that surfaced to the caller via the
snapshot remains eligible for the signal regardless of what has happened
to the live `Project` row or its `GroupProduct` edges since publish.

#### Scenario: Snapshot product archived after publish still triggers the signal

- **WHEN** a non-admin caller reads a published report whose snapshot surfaces a cross-group product
- **AND** that product has been archived since the report was published
- **THEN** the `scopeAccessed` event still fires, naming that product

#### Scenario: Snapshot product's GroupProduct edge removed after publish still triggers the signal

- **WHEN** a non-admin caller reads a published report whose snapshot surfaces a cross-group product
- **AND** the explicit `GroupProduct` edge that made it cross-group has since been removed
- **THEN** the `scopeAccessed` event still fires, naming that product

#### Scenario: Live (non-published) reads are unaffected

- **WHEN** a non-admin caller reads a report that is not yet published
- **THEN** the cross-group signal is computed from the live, currently-scoped project list
