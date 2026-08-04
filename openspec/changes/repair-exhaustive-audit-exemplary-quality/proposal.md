## Why

The repository was reported as exhaustively reviewed even though the supplied audit correction records that every file was not manually reviewed and 239 internal JSDoc blocks plus 79 product files outside the exemplary floor remained. The refreshed `2026-07-30-exhaustive-style-audit` inventory now covers 3974 current files but still records 145 pending reviews and 709 accepted findings (P0 13, P1 229, P2 402, P3 65), so completion needs a final-blob ledger and enforceable quality gates rather than another sample-based claim.

## What Changes

- Adjudicate and remediate every accepted finding against current source, preserving a source-grounded verdict and direct verification.
- Review every maintained current-tree file from its final blob; completion requires zero pending or implicit exclusions.
- Raise all product files onto the documented exemplary floor: no unproved suppression or path exemption, files at most 300 lines, functions at most 70 lines, cognitive complexity below 10, and no avoidable mutation or fallback.
- Harden ESLint, Stylelint, Prettier, type-coverage, test-marker, and scope gates with planted violations proving that the configured command actually fails.
- Apply the repository comment/JSDoc/marker policy file by file and relocate load-bearing rationale before compression.
- Rebuild the machine-readable ledger, consolidation, reports, roadmap, and rendered HTML from final blobs.
- **BREAKING**: internal modules, tests, and configuration may be reshaped during the MVP phase; public product behavior and wire contracts remain unchanged unless a finding proves they violate an existing durable spec.

### Non-goals

- Requiring server-side CI; the owner explicitly waived it for this campaign.
- Copying an external company style guide verbatim or adding rules with no measured repository signal.
- Treating green mechanical gates as a substitute for manual semantic and comment review.

## Capabilities

### New Capabilities

- `exhaustive-quality-remediation`: Final-blob inventory, finding disposition, remediation evidence, and zero-pending completion contract.

### Modified Capabilities

- `exemplary-finding-adjudication`: Extend adjudication from recorded flags to every current maintained file and all final changes.
- `exemplary-repo-floor`: Make the campaign target universal rather than ratchet-only and require explicit treatment of every exception.
- `lint-max-strictness-standard`: Require measured rule activation, planted probes, and the documented structural thresholds across the full product scope.
- `lint-toolchain-ownership`: Close formatter/style/type-coverage scope gaps and require zero-warning aggregate execution.
- `lint-suppression-adjudication`: Revalidate every retained directive and configuration exemption against final source.

## Impact

Touches all maintained source, test, configuration, schema, operational, and curated-documentation surfaces; `eslint.config.ts`, Prettier/Stylelint/type-coverage configuration, lint-gate scripts, OpenSpec deltas, and the external audit archive. No new production dependency or server-CI run is required.
