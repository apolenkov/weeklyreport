# Tasks

## 1. API

- [x] 1.1 Capture validated previous/next Organization in one repository row-locked transaction; preserve missing-singleton failure; verify repository unit test.
- [x] 1.2 Route captured pair through service to audit, retaining Organization wire DTO and cache clearing; verify service test and router diff.
- [x] 1.3 Adapt existing module tests for transition result and missing singleton without adding product seams; verify both focused unit files.

## 2. Verification

- [x] 2.1 Run focused single-file unit checks (`nice -n 15`, `--maxWorkers=1`, auth/switcher false), changed-file formatting, `git diff --check`, scoped `openspec validate task503-wave1-organization-audit --strict`; record commands/results externally.
- [ ] 2.2 Coordinator: preserve original C0464 RED and run native real-PG GREEN with pauseBeforeTransaction, then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` and independent review.
