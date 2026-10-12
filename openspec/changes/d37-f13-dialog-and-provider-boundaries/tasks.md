# Tasks

## 1. Shared UI

- [x] 1.1 Remove only unused CardHeader action variant; verify current consumers and lint/format. Preserve already-correct Sheet state.

## 2. Web

- [x] 2.1 Repair provider pending activation, measurement and typed callbacks; verify public-card RED/GREEN.
- [x] 2.2 Preserve prompt discard pending action; verify public AiTab deferred mutation RED/GREEN.
- [x] 2.3 Preserve background reopen focus on both surfaces; verify real QueryClient RED/GREEN and existing load-more controls.
- [x] 2.4 Repair unresolved Item/Risk validation and current-read-only Risk confirmation; verify public editor/section RED/GREEN.

## 3. Evidence

- [x] 3.1 Run scoped ESLint on changed source/tests, Prettier, git diff --check and strict OpenSpec validation; seal exact commands and source hashes externally.
- [ ] 3.2 Root runs pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check and relevant native browser/AT acceptance on the integrated tree.

## Workflow follow-up

- Root owns aggregate independent review, ordinary hooks, delivery and archival.
