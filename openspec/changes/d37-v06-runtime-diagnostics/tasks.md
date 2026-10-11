# Tasks

## 1. API diagnostic boundaries

- [x] 1.1 Preserve actual Nest Error name/stack with explicit caller priority and no cause traversal; prove real ExceptionHandler-to-AppLogger RED/GREEN in existing nest-app-logger.adapter.test.ts and maintain the error-trace-correlation delta.
- [x] 1.2 Return safe reseed status without child output/cause; prove actual seed guard refusal-to-tRPC RED/GREEN and successful stdout omission in existing dev.router.test.ts and maintain the destructive-db-guard delta.

## 2. Scoped integration and handoff

- [x] 2.1 Run the two changed test files using nice10 Vitest maxWorkers1/fileParallelismfalse, changed-file Prettier, scoped ESLint, git diff --check and openspec validate d37-v06-runtime-diagnostics --strict; preserve actual commands/exits in D37-V06 evidence.
- [ ] 2.2 Coordinator: synchronize main specs, integrate with normal hooks, and run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check plus independent aggregate final review on the integrated tree.
