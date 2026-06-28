## ADDED Requirements

### Requirement: Section writes use optimistic concurrency control

The system SHALL guard every report-section write with a monotonic version so a
stale write cannot silently overwrite a newer one. `ReportSection` carries a
`version Int @default(1)` column. `saveSection` (the repository method behind
`saveDraft` and `submitSection`) updates the row with a conditional
`updateMany where { id, version: expected }` that increments `version` by one;
when the expected version no longer matches it discards no data and instead
signals a conflict. The expected version travels from the read model the client
loaded, through the save payload, to the repository.

#### Scenario: Two saves race on the same section

- **GIVEN** two writers — for example one lead in two browser tabs, or autosave
  racing a manual save — both loaded `version` 3 of the same section
- **WHEN** the first save commits and bumps the row to `version` 4
- **THEN** the second save's `updateMany where { id, version: 3 }` matches zero
  rows
- **AND** the second writer's items, risks, and decisions are not deleted or
  recreated
- **AND** the first writer's content remains intact

#### Scenario: A single up-to-date save succeeds

- **GIVEN** a lead loaded `version` 4 and is the only writer
- **WHEN** they save with expected `version` 4
- **THEN** the conditional update matches one row
- **AND** the persisted `version` becomes 5
- **AND** the saved read model returned to the client reports `version` 5

### Requirement: Version conflicts surface as HTTP 409

The system SHALL surface a section-write version conflict as a typed domain
error mapped to tRPC `CONFLICT` (HTTP 409), never as a `500` and never as a
silent success. A new domain error in the report-sections module is added to
`apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` and resolves to
`CONFLICT`, alongside the existing publication-conflict branch. The client can
distinguish a conflict from a validation `BAD_REQUEST` and reload the section
before retrying. A same-client save queued while an earlier save is in flight
SHALL adopt the bumped version returned by that earlier save before it fires, so
the continuation does not self-conflict against the version loaded before the
first save and does not lose its queued local edits to a recovery refetch.

#### Scenario: A stale save is rejected

- **GIVEN** a section whose stored version is newer than the client's expected
  version
- **WHEN** the client calls the draft-save (or submit) procedure
- **THEN** the procedure rejects with tRPC code `CONFLICT`
- **AND** the response status is HTTP 409
- **AND** no child rows are deleted or recreated for that section

#### Scenario: The lead form recovers from a conflict

- **WHEN** the lead form receives a `CONFLICT` for a save
- **THEN** it does not present the save as succeeded
- **AND** it refetches the section so the next save carries the current version

#### Scenario: A queued autosave continuation adopts the bumped version

- **GIVEN** a lead loaded `version` 4 and edits again while the first save is
  still in flight, queuing a second save that still references `version` 4
- **WHEN** the first save succeeds and bumps the row to `version` 5
- **THEN** the queued save adopts `version` 5 before it fires
- **AND** the queued save does not raise a `CONFLICT`
- **AND** the lead's queued local edits are preserved, not discarded by a refetch

### Requirement: The server mints child-row identifiers on create

The system SHALL NOT trust client-supplied primary keys when creating section
child rows (items, risks, decisions). The repository lets the database mint
each child id rather than passing `i.id` / `r.id` / `d.id` from the read model
into `createMany`. If a unique-constraint violation (`P2002`) nonetheless
occurs on a child write, it is mapped to `BAD_REQUEST`, never an unhandled
`500`.

#### Scenario: A stale or cross-section child id is sent

- **GIVEN** a save payload whose item carries a primary key that already exists
  on another section
- **WHEN** the section is saved
- **THEN** the create does not reuse the client-supplied id
- **AND** the request does not fail with an unhandled `500`

#### Scenario: A unique conflict still maps cleanly

- **WHEN** a child-row create raises Prisma `P2002`
- **THEN** the error surfaces as tRPC `BAD_REQUEST`, not `INTERNAL_SERVER_ERROR`

### Requirement: Fill-From honours the same write integrity

The system SHALL apply the same concurrency and id-trust rules to
`fillFromSection`. Copying a prior section into the current one performs its
delete-then-recreate under the version compare-and-set on the target section,
rejects with `CONFLICT` when the target was modified concurrently, and lets the
database mint the copied child ids.

#### Scenario: Fill-From races a concurrent edit of the target

- **GIVEN** a target section at `version` 2 that another writer bumps to
  `version` 3 mid-flight
- **WHEN** Fill-From attempts its copy with expected `version` 2
- **THEN** the copy is rejected with tRPC `CONFLICT`
- **AND** the target section's existing child rows are left unchanged
