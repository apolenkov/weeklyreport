## ADDED Requirements

### Requirement: Admin Snapshot Restore Preserves the Full Lifecycle Field Set

The admin snapshot export (`getSnapshot`) and restore (`applySnapshot`) MUST
round-trip a `Report`'s complete governed lifecycle field set — `periodState`,
the legacy `status` and `archived` tuple, `periodStatus`, the
`autoPublished` / `autoArchived` audit flags, and the
`publishedAt` / `publishedById` / `reopenedAt` timestamps — so a restored period
is never left in a state the `period-dual-state` invariant forbids.

The restore reinstates these independently-persisted values verbatim; it MUST
NOT derive them through the transition module, because no single transition can
reproduce a legitimately-divergent row (a reopened period is `status="published"`
while `periodState="open"` and `periodStatus="reopened"`). The restore therefore
remains a recognised non-transition writer and keeps its explicit
gate opt-out marker.

A snapshot taken before this field set existed MUST still restore to an
internally-consistent row by falling back to the documented legacy-tuple
backfill for any absent field.

#### Scenario: A published period survives a snapshot round-trip

- **WHEN** a published `Report` is captured by `getSnapshot` and later restored
  by `applySnapshot`
- **THEN** the restored row has `status="published"`, `periodStatus="published"`,
  and `periodState="published"`
- **AND** it is visible to viewers and serves its published snapshot, exactly as
  before the round-trip

#### Scenario: A reopened period is not flattened by restore

- **WHEN** a reopened `Report` (`status="published"`, `periodState="open"`,
  `periodStatus="reopened"`) is captured and restored
- **THEN** all three machines are reinstated to their distinct captured values
- **AND** the restore does not derive `status` from `periodState` (which would
  flip it back to `"draft"`)

#### Scenario: A legacy snapshot restores to a consistent row

- **WHEN** a snapshot that predates the extended field set is restored
- **THEN** absent lifecycle fields are filled from the legacy-tuple backfill
  (e.g. `archived` ? `archived` : `status="published"` ? `published` : `open`)
- **AND** the restored row is internally consistent, never `status="published"`
  with a stale default `periodState="open"`
