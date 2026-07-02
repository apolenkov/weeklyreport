## Why

Several reachable API paths — lead-form `fillFrom`/`revokeSubmission`, admin
`attachProductToGroup`, admin `unarchivePeriod`, and publication
`getAssembledReport` — throw bare `Error` when they encounter an ownership
denial, a state conflict, or a missing resource. Because `mapDomainError` has no
branch for a bare `Error`, every one of these failures reaches the client as
`INTERNAL_SERVER_ERROR` with the message "Unexpected error". Real 403/404/409
conditions look like server crashes, the user-facing guidance is discarded, and
the error-rate signal in logs is polluted with false server faults.

The `requestReopen` path (reopen-request-lifecycle) is the established
pattern: a typed domain error class + a mapper branch. Extending that pattern
to the four uncovered paths closes the gap without introducing new machinery.

## What Changes

- `lead-form.service.ts` — replace bare `Error` in `fillFrom` and
  `revokeSubmission` with `LeadFormAccessError` (ownership denial → FORBIDDEN),
  the new `LeadFormConstraintError` (state-constraint violations → BAD_REQUEST),
  or the existing `LeadFormDomainError` (missing resource → NOT_FOUND). This
  covers BOTH the target-section guards (missing, non-owner, submitted,
  published-period) AND the source-section guards in `fillFrom`: a missing
  source section (→ NOT_FOUND) and a forged cross-author source where the caller
  is not the source owner (→ FORBIDDEN). The forged-source guard is
  security-relevant — without a typed class it surfaces as a false
  `INTERNAL_SERVER_ERROR` instead of a 403.
  `LeadFormConstraintError` is a new typed class, parallel to `ReopenRequestError`,
  declared in `lead-form-shared.ts`.
- `lead-form.prisma-repository.ts` — replace the bare `Error` in
  `fillFromSection` (source section re-read) with `LeadFormDomainError` (→
  NOT_FOUND). The service prechecks source existence, but the repository copy
  path re-reads the source and would surface a false `INTERNAL_SERVER_ERROR` if
  the source disappears between the service precheck and the copy (a TOCTOU
  race). Typing it preserves NOT_FOUND on that same `fillFrom` path.
- `lead-form-shared.ts` — introduce `LeadFormConstraintError` (extends `Error`,
  maps to BAD_REQUEST; declared next to `ReopenRequestError`).
- `admin-group-product.queries.ts` — introduce `AdminGroupProductConflictError`;
  throw it when `attachProductToGroup` finds a product already owned by another
  group.
- `admin-period.queries.ts` — replace bare `Error` in `unarchivePeriod` with the
  existing `AdminPeriodNotFoundError`.
- `publication.service.ts` — introduce `PublicationNotFoundError`; throw it in
  `getAssembledReport` when the report row is absent.
- `trpc.error-mapper.ts` — add BAD_REQUEST branch for `LeadFormConstraintError`,
  CONFLICT branch for `AdminGroupProductConflictError`, and NOT_FOUND branch for
  `PublicationNotFoundError`.
- Tests — extend `trpc.error-mapper.test.ts` to cover the three new classes plus
  `LeadFormAccessError` and `AdminPeriodNotFoundError` (newly load-bearing here,
  no direct mapper test today); add contract tests for the `revokeSubmission`
  state guard and the `fillFrom` target-owner and forged cross-author source
  guards.

## Capabilities

### New Capabilities

- `domain-error-mapper`: The contract governing which typed domain error classes
  exist across API modules and how `mapDomainError` translates each to a tRPC
  status code. Covers the classification rules (FORBIDDEN/BAD_REQUEST/NOT_FOUND/
  CONFLICT/INTERNAL_SERVER_ERROR) and the invariant that bare `Error` always
  falls through to `INTERNAL_SERVER_ERROR` with `cause` preserved.

### Modified Capabilities

_(none — `client-error-policy` governs the web reporting seam only; this change
is API-side.)_

## Impact

- **`apps/api/src/modules/report-sections/lead-form.service.ts`** — throw sites
  changed; import list grows by zero (error classes already in scope).
- **`apps/api/src/modules/report-sections/lead-form.prisma-repository.ts`** —
  single `fillFromSection` source-missing throw changed to `LeadFormDomainError`
  (already imports from `./lead-form-shared`; add the class to that value
  import).
- **`apps/api/src/modules/admin/admin-group-product.queries.ts`** — new class
  `AdminGroupProductConflictError`; local or extracted to `admin-shared.ts`.
- **`apps/api/src/modules/admin/admin-period.queries.ts`** — single throw site
  changed to use existing `AdminPeriodNotFoundError`.
- **`apps/api/src/modules/publication/publication.service.ts`** — new class
  `PublicationNotFoundError`.
- **`apps/api/src/infrastructure/trpc/trpc.error-mapper.ts`** — two new
  `instanceof` branches added; existing branches untouched.
- **Tests** — `trpc.error-mapper.test.ts`, `lead-form.contract.test.ts`,
  `lead-form.prisma-repository.integration.test.ts`.
- No schema changes, no frontend changes, no API surface changes.
