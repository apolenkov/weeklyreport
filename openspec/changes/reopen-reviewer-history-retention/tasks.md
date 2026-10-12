# Tasks

## 1. Reopen history contract and persistence

- [x] 1.1 Extend the existing admin reviewer-history PostgreSQL owner with approved/rejected reopen authors and both transaction orders; demonstrate RED against SET NULL and preserve existing history/deactivation/reference-free coverage.
- [x] 1.2 Set the schema relation to RESTRICT and add the atomic forward migration; demonstrate GREEN and verify existing NULL authors, status, dates and notes survive the actual SQL migration.
- [x] 1.3 Synchronize the reopen-requests contract, including historical NULL authors and system-note classification; validate the change and synchronized spec with OpenSpec strict validation.

## 2. Integration acceptance and delivery

- [x] 2.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the delivery tree under wr-heavy; record exact command exits, tree/SHA and bounded resources.
- [ ] 2.2 Obtain coordinator Opus acceptance of the final diff and evidence, then deliver to main through normal hooks and read its CI once; verify remote SHA and task acceptance.
- [ ] 2.3 Preserve the final REPORT and acceptance proof, archive the completed OpenSpec change and remove only the task-owned worktree and branch after main delivery.
