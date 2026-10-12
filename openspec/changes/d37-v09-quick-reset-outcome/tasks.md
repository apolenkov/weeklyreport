# Tasks

## 1. Quick reset command boundary

- [x] 1.1 Capture crawler exit, attempt only requested reset and disclose reset failures; verify genuine tester-kit-walk.test.ts RED becomes GREEN for success/failure and no-reset controls.
- [x] 1.2 Preserve exact command exits, targeted format/lint/shell syntax/diff and strict change validation with the source patch in D37-V09 handoff.

## 2. Coordinated acceptance

- [ ] 2.1 Root runs the native guarded quick crawl/reset failure cycle and aggregate pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check on the integrated SHA before archival.
