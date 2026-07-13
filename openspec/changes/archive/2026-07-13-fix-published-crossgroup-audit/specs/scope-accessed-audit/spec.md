## ADDED Requirements

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
- **THEN** the cross-group signal is computed from the live, currently-scoped project list, as before
