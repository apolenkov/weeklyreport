# Tasks

## 1. Web reasoning feedback

- [x] 1.1 Retire only corrected local custom reasoning validation and prove actual AiProviderForm DOM RED/GREEN in the existing approved wrapper-state test, preserving blank/invalid refusal, ordinary submit and shared/provider policy.

## 2. Scoped checks and integration

- [x] 2.1 Run nice10 focused Vitest maxWorkers1/fileParallelismfalse, scoped ESLint, changed-file Prettier, git diff --check and openspec validate d37-v14-reasoning-feedback --strict; preserve exact commands/exits in the handoff.
- [ ] 2.2 Coordinator: synchronize the main spec, integrate with normal hooks, run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check and the one final independent aggregate review. Native browser/AT remain separate acceptance.
