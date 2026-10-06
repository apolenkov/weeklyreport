# Spec Delta

## ADDED Requirements

### Requirement: Snapshot restore writes the canonical email identity it validates

`upsertUsers` MUST persist each restored user's `normalizeEmail` form on both
create and update, so a snapshot that passes case-insensitive email
uniqueness can never restore a live graph that a later export would reject.
The restored `samlId` MUST remain the verbatim snapshot email — restore MUST
NOT case-fold, trim, or otherwise normalize the external identity.

#### Scenario: Restored users round-trip through export validation

- **GIVEN** a valid snapshot whose users carry mixed-case emails
- **WHEN** the snapshot is restored and a fresh admin snapshot is exported
- **THEN** the exported snapshot parses with no duplicate-email issue

#### Scenario: samlId survives restore verbatim

- **GIVEN** a snapshot user whose email has uppercase characters
- **WHEN** the restore creates the user row
- **THEN** `samlId` equals the snapshot email byte-for-byte
