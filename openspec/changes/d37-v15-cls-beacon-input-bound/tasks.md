# Tasks

## 1. Confirm the actual producer boundary

- [x] 1.1 Extend existing schema/controller tests and capture genuine RED with real histogram observation.

## 2. Enforce the admitted CLS input contract

- [x] 2.1 Add the shared-schema CLS-specific bound and verify serial focused GREEN with preserved timing controls.

## 3. Deliver truthful evidence

- [x] 3.1 Validate the unique OpenSpec change, seal all declared owners, preserve the review-text checkpoint and deliver the combined seven-artifact packet; leave native acceptance to Root.

## Verification commands

- Shared: `pnpm exec vitest run --config vitest.base.config.ts packages/shared/src/schemas/observability/web-vitals.test.ts --maxWorkers=1 --fileParallelism=false` and the existing review schema test, each separately.
- API: `pnpm exec vitest run --config vitest.config.ts src/modules/observability/web-vitals.controller.test.ts --maxWorkers=1 --fileParallelism=false` from `apps/api`.
- Formatting: `pnpm exec prettier --check` on the exact five source/test files and ten unique OpenSpec files.
- Contracts: `openspec validate d37-v15-cls-beacon-input-bound --strict` and `openspec validate d37-v15-review-read-text-contract --strict`.
- Source: scoped `git diff --check`, protected-owner/index checks, base byte seals, and combined patch reverse check.
- Focused commands use the shared WR mutex, nice 10, and timeout 60 seconds; exact commands/exits/durations are in the external packet.
