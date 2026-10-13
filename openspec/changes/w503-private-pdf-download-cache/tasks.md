# Tasks

## 1. API PDF download

- [x] 1.1 Extend the existing successful artifact stream test with the private no-storage response assertion and preserve a pre-fix RED receipt.
- [x] 1.2 Add the cache header before artifact streaming and verify the full colocated download-handler suite is GREEN.

## 2. Planning and handoff

- [x] 2.1 Run focused ESLint, Prettier, strict OpenSpec validation and diff checks; hand off the scoped diff and exact RED/GREEN receipts to Root.

## Workflow follow-up

- Root owns independent review, commit/SHA, and `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the reviewed tree. These full gates have not been run by this subtask.
