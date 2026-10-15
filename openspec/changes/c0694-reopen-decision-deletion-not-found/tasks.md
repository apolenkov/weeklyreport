# Tasks

- [x] 1. Spec delta for `reopen-requests` (race-safe requirement, deletion scenario).
- [x] 2. Real-PG regression: deletion wins a decision blocked after its request read.
- [x] 3. Baseline RED on the lane database (expected `LeadFormConstraintError`).
- [x] 4. Map a `not-found` gate to `AdminReopenRequestNotFoundError`; unit case for the mapping.
- [ ] 5. GREEN of the regression and the existing lock suite; independent review.
