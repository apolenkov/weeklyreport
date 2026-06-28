## ADDED Requirements

### Requirement: Ownership-denied mutations surface as FORBIDDEN

The system SHALL classify an ownership-denied mutation in `fillFrom` as tRPC
`FORBIDDEN` by throwing `LeadFormAccessError` at the service layer and routing
it through the existing `LeadFormAccessError` branch in `mapDomainError`.
Covered operation: `fillFrom` invoked by a caller who is not the section author.

#### Scenario: fillFrom called on another lead's section

- **WHEN** `leadForm.fillFrom` is invoked with a `targetSectionId` owned by a
  different user
- **THEN** the tRPC procedure returns a `FORBIDDEN` error
- **AND** the error message is the human-readable denial reason, not
  "Unexpected error"

### Requirement: Lead-form state-constraint violations surface as BAD_REQUEST

The system SHALL classify a lead-form state-constraint violation as tRPC
`BAD_REQUEST` by throwing `LeadFormConstraintError` (a new typed class, parallel
to `ReopenRequestError`) and routing it through a new `BAD_REQUEST` branch in
`mapDomainError`. Covered violations: `fillFrom` on a submitted section,
`fillFrom` on a published-period section, and `revokeSubmission` on a
non-submitted section. `LeadFormConstraintError` is distinct from the existing
`LeadFormDomainError` (which maps to `NOT_FOUND` for missing-resource cases).

#### Scenario: fillFrom attempted on a submitted section

- **WHEN** `leadForm.fillFrom` is invoked and the target section has status
  `submitted`
- **THEN** the tRPC procedure returns a `BAD_REQUEST` error
- **AND** the error message states that a submitted section cannot be filled

#### Scenario: fillFrom attempted on a published period's section

- **WHEN** `leadForm.fillFrom` is invoked and the owning period has
  `periodStatus = "published"`
- **THEN** the tRPC procedure returns a `BAD_REQUEST` error
- **AND** the error message states that a published period's section cannot be
  filled

#### Scenario: revokeSubmission on a non-submitted section

- **WHEN** `leadForm.revokeSubmission` is invoked for a section whose status is
  not `submitted`
- **THEN** the tRPC procedure returns a `BAD_REQUEST` error
- **AND** the error message states that only submitted sections can be revoked

### Requirement: Missing-resource lookups surface as NOT_FOUND

The system SHALL classify a not-found resource as tRPC `NOT_FOUND` by throwing a
typed error at the service or query layer and routing it through the matching
`mapDomainError` branch. Covered sites:

- `lead-form.service.ts` `fillFrom`: target section absent → throw
  `LeadFormDomainError` (routes through the existing `LeadFormDomainError →
NOT_FOUND` branch).
- `admin-period.queries.ts` `unarchivePeriod`: report row absent → throw
  `AdminPeriodNotFoundError` (routes through the existing
  `AdminPeriodNotFoundError → NOT_FOUND` branch).
- `publication.service.ts` `getAssembledReport`: report row absent → throw
  `PublicationNotFoundError` (new class; new `NOT_FOUND` branch in
  `mapDomainError`).

#### Scenario: fillFrom target section is missing

- **WHEN** `leadForm.fillFrom` is invoked with a `targetSectionId` that does not
  exist in the database
- **THEN** the tRPC procedure returns a `NOT_FOUND` error
- **AND** the error message is not "Unexpected error"

#### Scenario: unarchivePeriod called on a missing report

- **WHEN** `admin.unarchivePeriod` is invoked with a `periodId` that does not
  exist in the database
- **THEN** the tRPC procedure returns a `NOT_FOUND` error

#### Scenario: getAssembledReport called with a missing reportId

- **WHEN** any tRPC procedure that calls
  `PublicationService.getAssembledReport` is invoked with a `reportId` that does
  not resolve to a Report row
- **THEN** the tRPC procedure returns a `NOT_FOUND` error
- **AND** the error message is not "Unexpected error"

### Requirement: Group-product attach conflict surfaces as CONFLICT

The system SHALL classify an `attachProductToGroup` conflict (product already
owned by a different group) as tRPC `CONFLICT` by throwing
`AdminGroupProductConflictError` at the query layer and routing it through a new
`CONFLICT` branch in `mapDomainError`. The error message SHALL name the current
owner group so the admin can detach the product before re-attaching.

#### Scenario: product already attached to another group

- **WHEN** `admin.attachProductToGroup` is called for a product that already
  belongs to a different reporting group
- **THEN** the tRPC procedure returns a `CONFLICT` error
- **AND** the error message names the current owner group

#### Scenario: idempotent re-attach to the same group

- **WHEN** `admin.attachProductToGroup` is called for a product that already
  belongs to the same target group
- **THEN** the call succeeds with the existing edge returned (no error)

### Requirement: Unclassified errors fall through to INTERNAL_SERVER_ERROR with cause preserved

The system SHALL route any error that is not an instance of a recognized domain
error class to tRPC `INTERNAL_SERVER_ERROR` with the message "Unexpected error"
and with `cause` set to the underlying `Error` instance (so the logging
middleware can log the stack and constructor). This fallback MUST remain the last
branch in `mapDomainError` and MUST NOT be tightened further.

#### Scenario: a truly unexpected error escapes a procedure

- **WHEN** an unrecognized error (e.g. a Prisma `PrismaClientKnownRequestError`
  without a specific domain wrapper) propagates out of a tRPC procedure
- **THEN** the client receives `INTERNAL_SERVER_ERROR` with message
  "Unexpected error"
- **AND** the server log contains the original error's constructor name, message,
  and stack via the `cause` field

### Requirement: Error mapper test coverage for every domain error class

The system SHALL have a unit test in `trpc.error-mapper.test.ts` that asserts
the correct tRPC code for each domain error class handled by `mapDomainError`,
including `LeadFormConstraintError`, `AdminGroupProductConflictError`, and
`PublicationNotFoundError` introduced by this change.

#### Scenario: mapper test matrix is exhaustive

- **WHEN** a new domain error class is added to `mapDomainError`
- **THEN** a corresponding test case in `trpc.error-mapper.test.ts` asserts the
  expected tRPC error code for that class
