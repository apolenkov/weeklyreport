# Tasks

## 1. Shared text contract and regression

- [x] 1.1 Define the selected invisible-only and exact-byte preservation contracts; verify with `openspec validate reject-invisible-only-safe-text --strict`.
- [x] 1.2 Extend the existing real-primitive rejection table and positive controls, including the stage-name read/write boundary; preserve an intended pre-fix RED receipt.
- [ ] 1.3 Extend only the shared predicate; verify the primary test and existing report, review, activity, search and assistant caller suites pass without changing successful bytes or length/null-byte guards.

## 2. Acceptance and delivery

- [ ] 2.1 Run changed-file formatting/lint and `git diff --check`; preserve exact commands and exits in the external evidence directory.
- [ ] 2.2 Freeze the code SHA and obtain Air003 results for `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm spec:check`; record exact-SHA independent Claude review and Root acceptance before normal atomic delivery.

## Workflow follow-up

- Synchronize the accepted schema-conventions delta through the normal OpenSpec archive workflow; retain raw proof outside the product tree.
- Keep whole C3679 and TASK-503.45 separate; do not imply Admin/SAML fields now use this primitive.
