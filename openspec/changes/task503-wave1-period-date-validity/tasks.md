# Tasks

Parent Backlog task: TASK-503. Design is omitted for the coordinator-approved local NaN guard; no new parsing or server policy is introduced.

## 1. Web period-envelope validity

- [x] 1.1 Extend existing create/edit dialog tests with invalid start/end values, associated errors, refused mutation and valid correction; preserve the expected RED output.
- [x] 1.2 Block unparseable envelope dates using the existing UTC submit format, expose start/end field errors and run the same single test file to GREEN without changing valid and optional-date behavior.

## 2. Scoped contract and handoff

- [x] 2.1 Run changed-file Prettier, strict OpenSpec validation and scoped `git diff --check`; deliver exact RED/GREEN receipts, scoped diff and hashes while preserving C4604.

## Coordinator acceptance

- [ ] 3.1 Coordinator records native extended-year admission, independent review and `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` results on the composed SHA before final acceptance.

## Workflow follow-up

- Coordinator owns commit, registry updates and archive.
- HTTP/database corruption is not asserted by these UI tests; prior actual transformer/schema refusal evidence remains separate.
