## ADDED Requirements

### Requirement: Snapshot view renders empty when the payload is absent

The snapshot view MUST render empty item, risk, and decision lists when
the snapshot payload is null in snapshot mode (still loading, or no data
for the selected version) — it never falls back to the current draft.
The extracted snapshot mappers
(`apps/web/src/lib/mappers/lead-snapshot.ts`) encode this rule: with a
null payload all four snapshot projections return `[]`. The snapshot
view never misrepresents historical state.

#### Scenario: snapshot payload not yet loaded

- **WHEN** the lead opens a snapshot version and the version payload has
  not loaded yet (or holds no data for that version)
- **THEN** the items, risks, and decisions sections render empty
- **AND** the current draft content is never shown inside the snapshot
  view
