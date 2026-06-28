## ADDED Requirements

### Requirement: Single-section revocation is bounded to the caller's reporting group

The system SHALL authorize the target section of `leadForm.revoke`
(`LeadFormService.revokeSubmission`) against the caller's allowed reporting
groups before flipping its status, using the same `reportSection` group-scope
filter (`groupScopeFilter(ctx.session, "reportSection")`) the read path and
`respondReopenRequest` use. The section MUST be loaded with the scope applied
(a scoped read); a section whose author is outside the caller's allowed groups
MUST be treated as not found and MUST NOT be written. The not-found rejection
MUST be a `NOT_FOUND`-equivalent tRPC error (a typed domain error the
error-mapper maps to `NOT_FOUND`, not a plain `Error` that surfaces as 500), and
MUST be indistinguishable from a genuinely missing id (no existence oracle). An
`admin` session MUST remain global (no group filter).

#### Scenario: Head revokes an in-group submitted section

- **GIVEN** a head authenticated for reporting group A
- **AND** a submitted `ReportSection` whose author belongs to group A
- **WHEN** the head calls `leadForm.revoke` with that section id
- **THEN** the section is flipped to `draft` with `revokedAt` / `revokedBy` set
- **AND** the call returns `{ success: true }`

#### Scenario: Head cannot revoke an out-of-group section by id

- **GIVEN** a head authenticated for reporting group A
- **AND** a submitted `ReportSection` whose author belongs to group B
- **WHEN** the head calls `leadForm.revoke` with the group-B section id
- **THEN** the call is rejected as not-found (a 404-equivalent tRPC error)
- **AND** the group-B section stays `submitted` and is not mutated

#### Scenario: Admin revokes any submitted section

- **GIVEN** an admin session (global scope, no group filter)
- **WHEN** the admin calls `leadForm.revoke` with any submitted section id
- **THEN** the section is flipped to `draft` regardless of its author's group

### Requirement: Bulk revocation revokes only the caller's own group's submissions

The system SHALL restrict `leadForm.revokeAllSubmitted`
(`LeadFormService.revokeAllSubmitted` →
`LeadFormRepository.revokeAllSubmitted`) to sections whose author is in the
caller's allowed reporting groups. The repository MUST collect the eligible
section ids with the `reportSection` group-scope filter applied (a scoped read
on `reportId` + `status: "submitted"` + scope), then write only those ids, so a
non-admin head revokes only their own group's submissions inside a multi-group
report, never the whole organisation's. An `admin` session MUST remain global and
revoke every submitted section in the report. The returned `revokedCount` MUST
reflect only the rows the caller was authorized to mutate.

#### Scenario: Head bulk-revokes a multi-group report

- **GIVEN** a head authenticated for reporting group A
- **AND** a report whose sections include submitted sections owned by group A and by group B
- **WHEN** the head calls `leadForm.revokeAllSubmitted` for that report
- **THEN** only the group-A submitted sections are flipped to `draft`
- **AND** the group-B submitted sections stay `submitted`
- **AND** the returned `revokedCount` counts only the group-A rows

#### Scenario: Admin bulk-revokes every submitted section

- **GIVEN** an admin session (global scope, no group filter)
- **WHEN** the admin calls `leadForm.revokeAllSubmitted` for a multi-group report
- **THEN** every submitted section in the report is flipped to `draft`
- **AND** the returned `revokedCount` counts all of them

#### Scenario: Head bulk-revokes a report with no in-group submissions

- **GIVEN** a head authenticated for reporting group A
- **AND** a report whose only submitted sections are owned by group B
- **WHEN** the head calls `leadForm.revokeAllSubmitted` for that report
- **THEN** no section is mutated
- **AND** the returned `revokedCount` is `0`

### Requirement: A regression test proves cross-group revocation is blocked

The system SHALL include a regression test, under
`apps/api/src/modules/report-sections/`, that authenticates a head for one
reporting group and attempts to revoke a section (and bulk-revoke a report)
owned by another group. The test MUST assert that the request is rejected at the
API boundary and that no out-of-group rows are mutated.

#### Scenario: Group-A head attempts to revoke group-B data

- **GIVEN** a test fixture with a group-A head and submitted group-B sections
- **WHEN** the test invokes `revoke` and `revokeAllSubmitted` as the group-A head against the group-B data
- **THEN** the single-section call rejects as not-found and the bulk call reports `revokedCount: 0`
- **AND** the group-B sections remain `submitted` after both calls
