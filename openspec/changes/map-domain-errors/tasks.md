## 1. New domain error classes

- [ ] 1.1 Add `LeadFormConstraintError` to `apps/api/src/modules/report-sections/lead-form-shared.ts` (extends `Error`, sets `this.name`; place next to `ReopenRequestError` with a matching JSDoc explaining it is a state-conflict class that maps to BAD_REQUEST)
- [ ] 1.2 Add `AdminGroupProductConflictError` to `apps/api/src/modules/admin/admin-shared.ts` (extends `Error`, sets `this.name`; follow the `AdminPeriodOverlapError` pattern)
- [ ] 1.3 Add `PublicationNotFoundError` to `apps/api/src/modules/publication/publication.service.ts` (extends `Error`, sets `this.name`; place next to `PublicationAccessError`)

## 2. Throw-site fixes — lead-form.service.ts

- [ ] 2.1 In `fillFrom`: replace bare `throw new Error(\`Target section … not found.\`)`with`throw new LeadFormDomainError(\`Target section … not found.\`)`
- [ ] 2.2 In `fillFrom`: replace bare `throw new Error("Can only fill your own section.")` with `throw new LeadFormAccessError("Can only fill your own section.")`
- [ ] 2.3 In `fillFrom`: replace bare `throw new Error("Cannot fill a submitted section.")` with `throw new LeadFormConstraintError("Cannot fill a submitted section.")`
- [ ] 2.4 In `fillFrom`: replace bare `throw new Error("Cannot fill a section of a published report.")` with `throw new LeadFormConstraintError("Cannot fill a section of a published report.")`
- [ ] 2.5 In `revokeSubmission`: replace bare `throw new Error(\`Section … not found.\`)`with`throw new LeadFormDomainError(\`Section … not found.\`)`
- [ ] 2.6 In `revokeSubmission`: replace bare `throw new Error("Only submitted sections can be revoked.")` with `throw new LeadFormConstraintError("Only submitted sections can be revoked.")`

## 3. Throw-site fix — admin-period.queries.ts

- [ ] 3.1 In `unarchivePeriod`: replace bare `throw new Error(\`Report … not found.\`)`with`throw new AdminPeriodNotFoundError(\`Report … not found.\`)`
- [ ] 3.2 Import `AdminPeriodNotFoundError` from `../admin-shared.js` at the top of `admin-period.queries.ts`

## 4. Throw-site fix — admin-group-product.queries.ts

- [ ] 4.1 Import `AdminGroupProductConflictError` from `../admin-shared.js` at the top of `admin-group-product.queries.ts`
- [ ] 4.2 In `attachProductToGroup`: replace bare `throw new Error(\`Product is already attached to …\`)`with`throw new AdminGroupProductConflictError(\`Product is already attached to …\`)`

## 5. Throw-site fix — publication.service.ts

- [ ] 5.1 In `getAssembledReport`: replace bare `throw new Error(\`Report … was not found.\`)`with`throw new PublicationNotFoundError(\`Report … was not found.\`)`

## 6. Mapper — trpc.error-mapper.ts

- [ ] 6.1 Import `LeadFormConstraintError` from `../../modules/report-sections/lead-form-shared.js` (add alongside existing `LeadFormAccessError` / `LeadFormDomainError` import)
- [ ] 6.2 Import `AdminGroupProductConflictError` from `../../modules/admin/admin-shared.js`
- [ ] 6.3 Import `PublicationNotFoundError` from `../../modules/publication/publication.service.js`
- [ ] 6.4 Add a `BAD_REQUEST` branch for `LeadFormConstraintError` adjacent to the `ReopenRequestError` block (same BAD_REQUEST cluster)
- [ ] 6.5 Add a `CONFLICT` branch for `AdminGroupProductConflictError` after the existing `AdminPeriodNotFoundError` block and before the `INTERNAL_SERVER_ERROR` fallback
- [ ] 6.6 Add a `NOT_FOUND` branch for `PublicationNotFoundError` adjacent to the `AdminPeriodNotFoundError` NOT_FOUND block

## 7. Tests

- [ ] 7.1 In `trpc.error-mapper.test.ts`: add a test case asserting `mapDomainError(new LeadFormConstraintError("…"))` returns a `TRPCError` with `code: "BAD_REQUEST"`
- [ ] 7.2 In `trpc.error-mapper.test.ts`: add a test case asserting `mapDomainError(new AdminGroupProductConflictError("…"))` returns a `TRPCError` with `code: "CONFLICT"`
- [ ] 7.3 In `trpc.error-mapper.test.ts`: add a test case asserting `mapDomainError(new PublicationNotFoundError("…"))` returns a `TRPCError` with `code: "NOT_FOUND"`
- [ ] 7.4 In `lead-form.contract.test.ts` (or a new `lead-form.service.test.ts`): add a test that asserts `revokeSubmission` of a non-submitted section rejects with `LeadFormConstraintError`
- [ ] 7.5 In `lead-form.contract.test.ts` (or the same file): add a test that asserts `fillFrom` with a non-owner caller rejects with `LeadFormAccessError`

## 8. Verification

- [ ] 8.1 Run `pnpm typecheck` — zero errors
- [ ] 8.2 Run `pnpm lint` — zero errors
- [ ] 8.3 Run `pnpm test` — all existing tests pass; new tests pass
- [ ] 8.4 Confirm no remaining bare `throw new Error(…)` in the five touched files that should be typed (grep each file manually)
