# Tasks

## Adjudication

- [x] Re-check and adjudicate all 57 unadjudicated roadmap records.
- [x] Record evidence for every verdict and prove the unadjudicated count is 0.

## Implementation

- [x] Land the first 23 local test, tooling, and product fixes with regression coverage.
- [x] Remove change-history labels from the two lead-form model comment sets.
- [x] Move product-only mock data into test utilities.
- [x] Replace the slide-editor fixture's double assertion with direct type checking.
- [x] Single-home reminder policy timing and validity calculations for runtime
      and backfill consumers.
- [x] Drive advanced-seed summary counts from writer results.
- [x] Scope seed coverage queries to the report created by that seed.
- [x] Require an explicit reminder-policy `validFrom` at the wire boundary.
- [x] Reject unknown cross-author workflow states and missing product names
      instead of presenting silent semantic fallbacks.
- [x] Require a PDF export queue in the service constructor so a queued job
      cannot be returned without an enqueue attempt.
- [x] Route manual-publish ingestion failures to the structured error sink
      while preserving post-commit success.
- [x] Replace the native user-group and dirty fill-from prompts with shared
      confirmation dialogs and regression coverage.
- [x] Single-home the duplicated reopen-response form and its note cap.
- [ ] Land the remaining 4 confirmed findings after the user decides the
      family-wide split-harness convention.
- [ ] Plan and land shared-schema/cross-feature changes in isolated slices.

## Verification

- [x] `openspec validate adjudicate-exemplary-findings --strict`
- [x] Relevant targeted tests and typechecks for the first landed slice.
- [x] `pnpm lint` and `pnpm test` for the first landed slice.
- [x] Repeat targeted and full verification for every autonomous slice.
