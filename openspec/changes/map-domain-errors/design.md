## Context

`mapDomainError` in `trpc.error-mapper.ts` is the single dispatch point that
converts every domain exception into a typed tRPC error before it reaches the
client. The convention is: each domain module declares its own error class(es);
`mapDomainError` has one `instanceof` branch per class. The fallback branch is
`INTERNAL_SERVER_ERROR` with `cause` preserved for the logging middleware.

Four throw sites currently bypass this convention by throwing bare `Error`:

| Site                                                    | Condition                              | Missing type                                                 |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `lead-form.service.ts` `fillFrom`                       | target section absent                  | `LeadFormDomainError` (existing, maps to NOT_FOUND)          |
| `lead-form.service.ts` `fillFrom`                       | caller is not owner                    | `LeadFormAccessError` (existing, maps to FORBIDDEN)          |
| `lead-form.service.ts` `fillFrom`                       | submitted section guard                | `LeadFormConstraintError` (**new**, maps to BAD_REQUEST)     |
| `lead-form.service.ts` `fillFrom`                       | published-period guard                 | `LeadFormConstraintError` (**new**, maps to BAD_REQUEST)     |
| `lead-form.service.ts` `revokeSubmission`               | section absent                         | `LeadFormDomainError` (existing, maps to NOT_FOUND)          |
| `lead-form.service.ts` `revokeSubmission`               | non-submitted state guard              | `LeadFormConstraintError` (**new**, maps to BAD_REQUEST)     |
| `admin-period.queries.ts` `unarchivePeriod`             | report absent                          | `AdminPeriodNotFoundError` (existing, maps to NOT_FOUND)     |
| `admin-group-product.queries.ts` `attachProductToGroup` | product already owned by another group | `AdminGroupProductConflictError` (**new**, maps to CONFLICT) |
| `publication.service.ts` `getAssembledReport`           | report row absent                      | `PublicationNotFoundError` (**new**, maps to NOT_FOUND)      |

All of these fall through to `INTERNAL_SERVER_ERROR` today.

## Goals / Non-Goals

**Goals:**

- Replace every bare `Error` at the eight listed throw sites with the
  appropriate typed domain error class.
- Add three new domain error classes: `LeadFormConstraintError`,
  `AdminGroupProductConflictError`, and `PublicationNotFoundError`.
- Add the corresponding `instanceof` branches to `mapDomainError`.
- Extend `trpc.error-mapper.test.ts` to cover every branch including the two
  new ones.

**Non-Goals:**

- No changes to the tRPC router signatures or client-side error handling.
- No changes to the `revokeAllSubmitted` or `getCrossAuthorContent` paths
  (those are owned by separate security findings).
- No changes to the `INTERNAL_SERVER_ERROR` fallback behavior — it stays as-is.
- No new shared-schema types or Zod changes.

## Decisions

**D1 — State-constraint violations use a new `LeadFormConstraintError → BAD_REQUEST`; missing-resource cases keep `LeadFormDomainError → NOT_FOUND`.**

The existing mapper has `LeadFormDomainError → NOT_FOUND`. State guards
(submitted section, published period, non-submitted revoke) are constraint
violations on resources that _exist_ — routing them to NOT_FOUND is semantically
wrong and misleads the caller. The repo already has the correct precedent:
`ReopenRequestError` was added precisely because lead-form needed a
state-conflict → BAD_REQUEST path distinct from the missing-resource path, with
an explicit comment "a state conflict, not a missing resource — distinct from
`LeadFormDomainError → NOT_FOUND`." This change follows the same pattern:
`LeadFormConstraintError` is the state-conflict twin, added to
`lead-form-shared.ts` next to `ReopenRequestError`. `LeadFormDomainError →
NOT_FOUND` is kept for genuinely-absent-resource cases (section not found).

**D2 — `AdminGroupProductConflictError` lives in `admin-shared.ts`.**

The file already holds `AdminPeriodOverlapError` (BAD_REQUEST) and
`AdminPeriodNotFoundError` (NOT_FOUND). Adding `AdminGroupProductConflictError`
there keeps the error catalog for the admin module centralized. It maps to
`CONFLICT` in the mapper, matching `PublicationAccessError` (already CONFLICT).

**D3 — `PublicationNotFoundError` lives in `publication.service.ts`.**

The pattern in every other module is: domain errors declared alongside the
service class, not in a separate shared file. `publication.service.ts` already
has `PublicationAccessError`; `PublicationNotFoundError` goes next to it.

**D4 — Mapper branch order: new branches inserted before the fallback.**

The fallback `INTERNAL_SERVER_ERROR` branch is always last. The new
`LeadFormConstraintError → BAD_REQUEST` branch is placed adjacent to
`ReopenRequestError` (same BAD_REQUEST cluster). New branches for
`AdminGroupProductConflictError` and `PublicationNotFoundError` are appended
after the existing `AdminPeriodNotFoundError` block and before the fallback.
This keeps the file readable (known → unknown).

## Risks / Trade-offs

**All eight sites have no integration tests today** (verified via codegraph). The
`trpc.error-mapper.test.ts` unit tests cover only the mapper function in
isolation. Changing throw sites without adding call-path tests means a future
refactor could accidentally revert to bare `Error` without a gate catching it.
Mitigation: the tasks include adding mapper unit tests for the two new classes
and a contract test for the `revokeSubmission` state guard (which lacks any test
coverage today).

**`getAssembledReport` is called by three callers inside `publication.service.ts`
itself** (`publishReport`, `publishAuto`, `updateSectionForReview`). All three
currently propagate the bare `Error` from the private helper. After this change
they will propagate `PublicationNotFoundError → NOT_FOUND`. The callers in the
tRPC router (`publishReport`, `getAssembledReport` direct call) will surface this
as a NOT_FOUND to the client — correct behavior, but a behavior change worth
calling out.

## Open Questions

_(none — the four call sites and two new classes are fully enumerated; no
schema or API surface changes are required.)_
