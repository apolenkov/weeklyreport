# Tasks

## 1. Persistence relation ordering

- [x] 1.1 Preserve activity/product name priorities with identity tie-breaks in the canonical mapper; prove RED/GREEN with actual live/frozen permutation results in the approved report-sections.include.test.ts.
- [x] 1.2 Add createdAt/reviewerId review order to the shared include; verify its public query contract in the same existing test without pretending to execute PG.

## 2. Scoped checks and integration

- [x] 2.1 Under Root's focused mutex, run one exact focused file at a time with nice10/maxWorkers1/fileParallelismfalse, scoped ESLint, changed-file Prettier, git diff --check and openspec validate d37-v14-deterministic-relations --strict; preserve actual commands/exits.
- [ ] 2.2 Coordinator: synchronize the main spec, integrate with normal hooks, run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check and one aggregate independent review. Real PG/native UI relation acceptance stays separate.
