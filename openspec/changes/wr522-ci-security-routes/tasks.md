# Tasks

- [x] 1. Spec deltas for `ci-merge-gate` and `dependency-vulnerability-scanning`.
- [x] 2. `secret-scan` job, script, config and synthetic controls.
- [x] 3. Single blocking `dependency-scan`; the withdrawn braces exception is removed from `pnpm-workspace.yaml` and the remaining development-only zod exception is recorded in the spec.
- [x] 4. `mutation-period` job, Stryker and Vitest mutation configs, contract test.
- [x] 5. `production-build` job with explicit build environment and manifest.
- [x] 6. ADR 0022; documentation.
- [x] 7. Run `pnpm --filter @weeklyreport/api test:mutation`: 100.00 (54 killed, 0 survived) at df20dd0b7; nested suites scored 20.37 (Stryker 10 vs Vitest 5 name filter), so the suite is flat.
- [x] 8. Run `pnpm build` with the job environment (4/4) and the six repository gates at df20dd0b7.
- [ ] 9. Read the first GitLab pipeline on `main` for the four new jobs.
