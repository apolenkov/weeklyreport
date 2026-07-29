# Change: Repair business acceptance gates

## Why

The full browser acceptance run exposed drift between the canonical `full` seed
profile and integration tests that still encode the previous seed's absolute
counts. It also exposed an obsolete Playwright role assertion for the submit
confirmation surface. These failures prevent the suite from distinguishing a
product regression from fixture evolution.

GitHub Actions currently rejects jobs before assigning a runner because of the
account billing/spending state. A green local gate therefore cannot be presented
as server-side execution evidence.

## What Changes

- Make integration assertions derive their baseline from the canonical seed or
  verify relative state transitions instead of freezing unrelated row counts.
- Keep observable accessibility contracts strict, including the submit
  confirmation's `alertdialog` role and accessible name.
- Execute and record the complete integration, production-build, CSP, UAT, and
  targeted business-journey matrix.
- Record GitHub Actions runner allocation separately from test conclusions so a
  pre-run infrastructure rejection cannot be described as a code-test failure
  or success.

## Impact

- Affected specs: `uat-quality-gates`, `seed-determinism`, `ci-merge-gate`
- Affected code: Playwright integration/UAT tests and acceptance evidence
- Product behavior: no intentional product behavior change
