# Tasks

## 1. Migration environment boundary

- [x] 1.1 Record genuine RED for final existing migration boundary tests, including inherited production and explicit safety-input controls.
- [x] 1.2 Resolve one guarded child environment in the owned operation and verify the same single-file fixture is GREEN.

## 2. Delivery

- [x] 2.1 Run scoped formatting/diff/OpenSpec checks and hand off exact source hashes, actual commands/exits and patch.
- [ ] 2.2 Root performs required aggregate gates, independent review and delivery, then syncs/archives the change.

Executed scoped commands: `pnpm exec vitest run --config vitest.prisma.config.ts prisma/operations/migrate-deploy.test.ts --maxWorkers=1 --fileParallelism=false` (RED1 then GREEN8 under prescribed singleton wrapper); one-file `pnpm exec prettier --write <owned-file>` and `pnpm exec eslint <owned-source-or-test> --max-warnings=0 --concurrency=off`; `pnpm exec openspec validate d37-v13-migrate-deploy-environment --strict`; scoped `git diff --check`. Broad typecheck and all six aggregate commands remain unrun and belong to Root's lane.
