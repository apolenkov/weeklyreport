# Tasks

## 1. Crawler ledger

- [x] 1.1 Add public reservation regressions for corruption and signed corrections;
      preserve RED output from `pnpm exec vitest run scripts/ui-crawl/rate.test.ts`.
- [x] 1.2 Reject corrupt persisted fields without altering history or refund
      semantics; verify the same focused regression command is GREEN.

## 2. Verification and handoff

- [x] 2.1 Run `pnpm exec prettier --check scripts/ui-crawl/rate.ts scripts/ui-crawl/rate.test.ts openspec/changes/w503-rate-ledger-integrity`,
      `pnpm exec eslint scripts/ui-crawl/rate.ts scripts/ui-crawl/rate.test.ts --max-warnings 0`,
      `openspec validate w503-rate-ledger-integrity --strict`, and `git diff --check`;
      deliver source hashes and RED/GREEN evidence to the wave author.

## Workflow follow-up

- Wave author runs all six repository gates on the consolidated source SHA and
  submits independent reviews before main integration.
