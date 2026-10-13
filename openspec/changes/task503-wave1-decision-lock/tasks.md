# Tasks

Parent Backlog task: TASK-503. Design is omitted because the coordinator approved the existing one-component guard fix and the conditional design artifact adds no unresolved decision.

## 1. Web decision delete permission

- [x] 1.1 Extend the existing public confirmation cases with a lock arriving after opening; execute the single test file and preserve the expected RED plus unlocked/read-only/Cancel controls.
- [x] 1.2 Recheck current published lock IDs on delete request and confirmation; execute the same test file and preserve GREEN with normal deletion and read-only behavior.

## 2. Scoped contract and delivery

- [x] 2.1 Validate `task503-wave1-decision-lock` strictly, check changed-file formatting and `git diff --check`, and deliver the scoped diff and exact RED/GREEN receipts to the coordinator.

## Coordinator acceptance

- [ ] 3.1 Coordinator runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check` on the composed tree and records their actual SHA and results before final acceptance.

## Workflow follow-up

- Coordinator owns independent review, commit, registry updates and archive.
- Browser/server persistence remains a separate evidence layer; local confirmation checks do not prove database acceptance.
