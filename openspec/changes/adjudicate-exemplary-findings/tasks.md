# Tasks

## Adjudication

- [x] Re-check and adjudicate all 57 unadjudicated roadmap records.
- [x] Record evidence for every verdict and prove the unadjudicated count is 0.

## Implementation

- [x] Land the first 23 local test, tooling, and product fixes with regression coverage.
- [x] Remove change-history labels from the two lead-form model comment sets.
- [x] Move product-only mock data into test utilities.
- [x] Replace the slide-editor fixture's double assertion with direct type checking.
- [ ] Land the remaining 15 confirmed findings in isolated slices.
- [ ] Plan and land shared-schema/cross-feature changes in isolated slices.

## Verification

- [x] `openspec validate adjudicate-exemplary-findings --strict`
- [x] Relevant targeted tests and typechecks for the first landed slice.
- [x] `pnpm lint` and `pnpm test` for the first landed slice.
- [ ] Repeat targeted and full verification for every remaining slice.
