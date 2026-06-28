## ADDED Requirements

### Requirement: Ownership-denied mutations surface as FORBIDDEN

The system SHALL classify an ownership-denied mutation in `fillFrom` as tRPC
`FORBIDDEN` by throwing `LeadFormAccessError` at the service layer and routing
it through the existing `LeadFormAccessError` branch in `mapDomainError`.
Covered cases: `fillFrom` invoked by a caller who is not the TARGET section
author, AND `fillFrom` invoked with a forged `sourceSectionId` whose author is
not the caller (a cross-author source copy). Both bypass the typed mapper today
and surface as a false `INTERNAL_SERVER_ERROR`; the forged-source case is
security-relevant because it gates copying another lead's content.

#### Scenario: fillFrom called on another lead's target section

- **WHEN** `leadForm.fillFrom` is invoked with a `targetSectionId` owned by a
  different user
- **THEN** the tRPC procedure returns a `FORBIDDEN` error
- **AND** the error message is the human-readable denial reason, not
  "Unexpected error"

#### Scenario: fillFrom called with a forged cross-author source section

- **WHEN** `leadForm.fillFrom` is invoked with a `sourceSectionId` whose author
  is a different user (a forged request, since the picker only offers the
  caller's own past sections)
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
- `lead-form.service.ts` `fillFrom`: source section absent → throw
  `LeadFormDomainError` (same existing `LeadFormDomainError → NOT_FOUND` branch).
- `lead-form.prisma-repository.ts` `fillFromSection`: source section absent on
  the copy-path re-read (a TOCTOU race after the service precheck) → throw
  `LeadFormDomainError` (same existing `LeadFormDomainError → NOT_FOUND` branch),
  so the source-missing classification holds even if the source row is deleted
  between the service precheck and the repository copy.
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

#### Scenario: fillFrom source section is missing

- **WHEN** `leadForm.fillFrom` is invoked with a `sourceSectionId` that does not
  exist in the database
- **THEN** the tRPC procedure returns a `NOT_FOUND` error
- **AND** the error message is not "Unexpected error"

#### Scenario: fillFrom source section deleted before the repository copy

- **WHEN** `leadForm.fillFrom` passes its service precheck but the
  `sourceSectionId` row is deleted before `fillFromSection` re-reads it for the
  copy
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

### Requirement: Error mapper test coverage for classes added or newly routed by this change

The system SHALL have a unit test in `trpc.error-mapper.test.ts` that asserts
the correct tRPC code for each domain error class that this change adds to or
newly routes errors through `mapDomainError`. Specifically: the three new
classes `LeadFormConstraintError` (BAD_REQUEST),
`AdminGroupProductConflictError` (CONFLICT), and `PublicationNotFoundError`
(NOT_FOUND); plus `LeadFormAccessError` (FORBIDDEN) and `AdminPeriodNotFoundError`
(NOT_FOUND), which this change makes load-bearing at previously bare-`Error`
throw sites and which lack a direct mapper test today. This requirement does
NOT obligate adding tests for pre-existing mapper branches untouched by this
change.

#### Scenario: a class added or newly routed by this change has a mapper test

- **WHEN** this change adds a domain error class to `mapDomainError`, or routes
  a previously bare-`Error` throw site through an existing mapper branch
- **THEN** `trpc.error-mapper.test.ts` contains a test case asserting the
  expected tRPC error code for that class
