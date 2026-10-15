# Tasks

## 1. Root automation

- [x] 1.1 Add a fixture regression exercising the actual prepare lifecycle against real main, linked and no-Git directories; demonstrate the linked-worktree failure on the baseline.
- [x] 1.2 Guard linked-worktree installation in the existing prepare entry and prove main success, main failure and no-Git compatibility.

## 2. Verification and handoff

- [x] 2.1 Run `nice -n 15 node --test scripts/gates/prepare-hooks.fixture.test.ts`, `openspec validate w503-linked-worktree-prepare-hooks --strict` and `git diff --check`; retain raw evidence outside the product tree.
- [x] 2.2 Coordinator: independently review and run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the reviewed tree after resource admission; verify ordinary install and shared hooks before delivery.
