## ADDED Requirements

### Requirement: Head Cross-Author Lead-Form Reads Enforce Group Scope

A head-role read of another author's lead-form section MUST be bounded to the
head's own reporting group before the target section is returned, even when the
target author is supplied by the client (`requestedAuthorId`) and resolved by
author-keyed `findUnique` rather than a guarded list method. The
service MUST assert the target author's reporting group is within the head's
allowed group ids (equivalently, `groupScopeFilter(session, "reportSection")`)
and MUST reject a cross-group target with a 403-equivalent access error,
returning no section rows. The `admin` role is exempt and reads
unconditionally.

#### Scenario: Head requests a section in another reporting group

- **WHEN** a head calls the by-period lead-form read with a `requestedAuthorId`
  whose author belongs to a different reporting group
- **THEN** the request is rejected with a 403-equivalent access error
- **AND** no section rows for the other group's author are returned

#### Scenario: Head requests a section in its own reporting group

- **WHEN** a head calls the by-period lead-form read with a `requestedAuthorId`
  whose author belongs to the head's own reporting group
- **THEN** the target author's full section is returned

#### Scenario: Admin requests any author's section

- **WHEN** an admin calls the by-period lead-form read with any
  `requestedAuthorId`
- **THEN** the group scope is not applied and the target author's full section
  is returned
