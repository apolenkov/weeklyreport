# Coverage Baseline — 2026-05-18

Date: 2026-05-18
Branch: feat/head-report-history-slides
Tests: 926 (api) + 480 (web) = 1406 total — all pass

## Status

Coverage thresholds are declared in `apps/api/vitest.config.ts` but
**`@vitest/coverage-v8` is not installed** in this environment.
The CI coverage gate exists as configuration but is not actively enforced.

```
apps/api/vitest.config.ts thresholds:
  statements: 80%
  branches:   70%
  functions:  80%
  lines:      80%
```

Web coverage config: not yet declared (no `coverage` block in
`apps/web/vitest.config.ts`). Adding a coverage gate for web is
deferred to v9.x.

## Notes

- This is an awareness baseline, not a gate. UAT proceeds against
  black-box behaviour, not line coverage.
- To actually measure coverage once `@vitest/coverage-v8` is available:

  ```bash
  pnpm --filter @customreport/api test -- --coverage
  pnpm --filter @customreport/web test -- --coverage
  ```

- Coverage CI-gate is a v9.x deliverable (see `.planning/STATE.md`).
