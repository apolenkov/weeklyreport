# Tasks

## 1. Tester stop owner

- [x] 1.1 Extend the existing executable stop tests with finite deletion argv and timeout cleanup/status cases; preserve a pre-fix focused RED receipt.
- [x] 1.2 Add a native finite deletion timeout and verify all stop tests, including guards, cancellation and cleanup status precedence, are GREEN.

## 2. Planning and handoff

- [x] 2.1 Run focused ESLint, Prettier, shell syntax, strict OpenSpec validation and diff checks; hand off the diff and exact RED/GREEN evidence to Root.

## Workflow follow-up

- Root owns independent review, commit/SHA and the required `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the reviewed tree. These full gates have not been run by this subtask.
