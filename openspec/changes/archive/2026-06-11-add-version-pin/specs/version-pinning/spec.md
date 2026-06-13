## ADDED Requirements

### Requirement: A lead can pin and unpin a version of their own section

A lead MUST be able to mark any existing version of their own report section
as pinned, and to unpin it later, through the `leadForm.setVersionPinned`
tRPC mutation. Pinning toggles the stored snapshot's `kind` between
`autosave` and `pinned` and MUST NOT create a new snapshot. The mutation
MUST reject a caller who is not the section author and MUST reject a section
whose status is `submitted`, matching the ownership and lock rules already
enforced by `createSnapshot` and `restoreVersion`.

#### Scenario: a lead pins an existing version

- **WHEN** a lead invokes `leadForm.setVersionPinned` with their own
  section's id, a version number, and `pinned: true`
- **THEN** that one `VersionSnapshot` row has `kind = 'pinned'`
- **AND** no new snapshot row is created

#### Scenario: a lead unpins a pinned version

- **WHEN** a lead invokes `leadForm.setVersionPinned` with `pinned: false`
  on a version currently pinned
- **THEN** that row returns to `kind = 'autosave'`

#### Scenario: a non-author or submitted section is rejected

- **WHEN** the caller is not the section author, or the section status is
  `submitted`
- **THEN** the mutation is rejected and no row changes

### Requirement: Pinned versions are exempt from retention pruning

A snapshot whose `kind` is `pinned` MUST never be removed by the time-based
retention sweep in `lead-form.prisma-repository.ts`, regardless of its age.
The sweep's `DELETE` MUST exclude pinned rows via an explicit
`"kind" <> 'pinned'` guard, and the three age-based keep-windows (all
< 24 h, hourly 24 h–7 d, daily 7–30 d) MUST stay unchanged for non-pinned
rows.

#### Scenario: a pinned snapshot older than 30 days survives

- **WHEN** a new snapshot is created and a pinned snapshot older than 30
  days exists for the same section
- **THEN** the pinned snapshot is still present after the sweep

#### Scenario: an unpinned snapshot in the same bucket is still thinned

- **WHEN** the retention sweep runs on a section with both pinned and
  unpinned rows in the 24 h–7 d window
- **THEN** unpinned rows are thinned by the hourly window as before
- **AND** the pinned row survives independent of its bucket

### Requirement: Snapshot kind is a closed enum with a writer per value

The `VersionSnapshot.kind` field MUST be a Prisma enum `VersionSnapshotKind`
with the values `autosave` and `pinned`, mirrored by a Zod enum in
`versionSnapshotSchema` (`@customreport/shared`). Each value MUST have a
production writer, satisfying the `enum-state-hygiene` invariant: `autosave`
is written by `createVersionSnapshot` as the column default on every
autosave, and `pinned` is written by `setVersionPinned`. The Zod field MUST
default to `autosave` so legacy rows and pre-existing callers keep parsing.

#### Scenario: every kind value has a writer

- **WHEN** the enum is scanned for declared-but-unwritten values
- **THEN** both `autosave` and `pinned` resolve to a production write path
  covered by a test

#### Scenario: a legacy row parses with the default kind

- **WHEN** the read model parses a snapshot whose `kind` is absent
- **THEN** it parses with `kind = 'autosave'` and does not error

### Requirement: Pinned versions are marked and surfaced first in the history

The version history surface MUST carry the pin state through the read model
and render it. `listVersions` MUST include `kind` in each parsed
`VersionSnapshot`, and the web mapper MUST expose a derived `pinned` boolean
on `LeadVersionSnapshot`. In `VersionHistoryNav`, pinned versions MUST be
grouped above the chronological list and each row MUST carry a star
pin/unpin control. The control MUST reuse an existing accent token and MUST
NOT introduce a new color, and row control heights MUST stay unchanged
(respecting `status-color-semantics` and `ui-control-density`).

#### Scenario: a pinned version appears in the pinned group

- **WHEN** the history modal renders a section that has one pinned version
- **THEN** that version appears in a pinned group above the chronological
  list and shows a marked (filled) star control

#### Scenario: any version can be pinned, not only the latest

- **WHEN** a lead opens the history modal and pins an older version
- **THEN** the star control is available on that row and pinning succeeds
  without requiring a return to the latest version
