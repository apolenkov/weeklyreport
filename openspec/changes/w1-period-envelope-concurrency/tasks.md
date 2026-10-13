# Tasks

## 1. API

- [x] 1.1 Forward and compare expected envelope values under the Report lock; verify focused manual-update unit tests, including stale rejection before reminder reconciliation.
- [ ] 1.2 Extend existing PostgreSQL integration cases for same-field conflicts, independent-field preservation and stale companion range rejection; coordinator verifies guarded native RED/GREEN.

## 2. Verification and handoff

- [x] 2.1 Check changed-file Prettier, git diff --check and openspec validate w1-period-envelope-concurrency --strict; deliver scoped diff and exact focused-test commands to TASK-503 evidence directory.
- [ ] 2.2 Coordinator runs pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the reviewed tree, plus independent Astra review.

## Workflow follow-up

- Coordinator owns delivery and archival after verification and review.
