## ADDED Requirements

### Requirement: Records carry a durable lineage key distinct from the row primary key

Every `Item`, `Risk`, and `Decision` SHALL carry a durable `stableId` lineage key
that is distinct from its database-minted primary key `id`. The `stableId` is minted
once at record creation (`stableId String @default(uuid())`) and identifies the
record's lineage; the primary key `id` remains database-minted and volatile, and no
client-supplied primary key is trusted on create (the `add-section-optimistic-lock`
rule is preserved). The key is surfaced on the item / risk / decision read models
(required) and accepted on their save inputs (optional, because a brand-new
client-side record has none yet). A `@@unique([reportSectionId, stableId])`
constraint makes `(reportSectionId, stableId)` a trustworthy per-section key, and a
`@@index([stableId])` supports lineage-wide lookups.

#### Scenario: A new record is minted a stable key

- **GIVEN** a lead adds a new item that carries no `stableId`
- **WHEN** the section is saved
- **THEN** the created row receives a database-defaulted `stableId`
- **AND** that `stableId` is distinct from the row's primary key `id`
- **AND** the saved read model returned to the client reports the `stableId`

#### Scenario: Two records in one section have distinct keys

- **GIVEN** a section with two distinct decisions
- **WHEN** the section is saved
- **THEN** the two decisions carry different `stableId` values
- **AND** the `(reportSectionId, stableId)` uniqueness guard is not violated

### Requirement: The lineage key survives saveSection's delete-recreate

A record's `stableId` SHALL be preserved when `saveSection` deletes and recreates the
section's child rows, even though the primary key `id` is re-minted. The `stableId`
travels from the read model the client loaded, through the save payload, into the
`createMany` write, and back onto the persisted row — the same end-to-end threading
`add-section-optimistic-lock` used for `version`. Because `saveSection` recreates
children under a fixed `reportSectionId`, the `(reportSectionId, stableId)` pair is
stable across saves and is the anchor period-scoped record-level features attach to.

#### Scenario: An edit-and-save keeps the record's identity

- **GIVEN** an item whose `stableId` is `L` and whose primary key `id` is `p1`
- **WHEN** the lead edits an unrelated field and saves the section
- **THEN** the delete-recreate persists a row whose `stableId` is still `L`
- **AND** the row's primary key `id` may differ from `p1`
- **AND** the `(reportSectionId, stableId)` anchor is unchanged

#### Scenario: A dropped key would reset identity — every link must carry it

- **GIVEN** the read model, the save payload input schema, and the `createMany`
- **WHEN** any one of them omits `stableId`
- **THEN** the record would receive a fresh default on the next save and its identity
  would silently reset
- **AND** therefore all three SHALL carry the `stableId`

### Requirement: Carry-over copies the lineage key onto the cloned record

A carried clone SHALL keep its source record's `stableId` while receiving a fresh
primary key `id`, so the carried instance shares one lineage key with its origin
when carry-over clones a carried item or an unresolved decision into the next
period. The
clone builders (`cloneCarriedItem` / `cloneUnresolvedDecision`) preserve the source
`stableId`, and the separate carry-over write path (`saveCarryOver`) persists it in
its own `createMany`. Because the target period is a different `ReportSection`
(`@@unique([reportId, authorId])`), the carried instance has the same `stableId` but a
different `(reportSectionId, stableId)` anchor — so a lineage-wide feature (the
lifecycle lock) can treat it as the same позиция via `stableId` alone, while a
period-scoped feature (a comment anchor) does not leak across the period boundary.
Risks are out of scope: `carryOver.execute` does not carry risks today, so risks get
mint-and-preserve only, with no carry path until a change adds one.

#### Scenario: A carried item shares its origin's lineage key

- **GIVEN** a next-week item with `stableId` `L` in period N
- **WHEN** carry-over clones it into period N+1
- **THEN** the cloned row's `stableId` is `L`
- **AND** the cloned row's primary key `id` differs from the source row's
- **AND** the two instances have different `(reportSectionId, stableId)` anchors
  because the periods are different `ReportSection`s

#### Scenario: Lineage-wide and period-scoped reads diverge as intended

- **GIVEN** the period-N item and its period-(N+1) carried clone, both `stableId` `L`
- **WHEN** a lineage-wide query keys on `stableId` alone
- **THEN** it matches both instances (one continuing позиция)
- **AND WHEN** a period-scoped query keys on `(reportSectionId, stableId)`
- **THEN** it matches only the instance in that period

### Requirement: This change is a foundation and builds no record-level feature

This change SHALL introduce only the durable lineage key and its persistence — the
schema column, both save paths, and carry-over — and SHALL NOT implement any
record-level feature that consumes it. The published-record lifecycle lock,
move-in-place, and per-record comment anchors remain owned by their own changes
(`unified-activity-entry`, `review-acknowledgement`) and are out of scope here; this
change only makes the stable key they require exist.

#### Scenario: No observable feature behavior changes

- **GIVEN** the lineage key is introduced and threaded end-to-end
- **WHEN** a lead or head uses the app exactly as before
- **THEN** no lifecycle lock, move-in-place, or comment behavior is added or altered
- **AND** the only change is that records now carry a stable key across saves and
  carry-over
