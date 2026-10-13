# Tasks

## 1. API

- [x] 1.1 Add required-session preview service/port/repository path and wire review router; verify caller-session propagation in the existing target test and reject a missing repository session before querying.
- [ ] 1.2 Extend existing PostgreSQL publication integration coverage for scoped sections, scoped portfolio, groupless denial, Admin full preview and full internal publication; coordinator executes the native checks.

## 2. Verification and delivery

- [x] 2.1 Run focused unit tests, changed-file formatting, scoped OpenSpec validation and git diff --check; preserve exact commands/results in the external C0499 handoff.
- [ ] 2.2 Coordinator runs native PostgreSQL acceptance, pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check, independent review and delivery.
