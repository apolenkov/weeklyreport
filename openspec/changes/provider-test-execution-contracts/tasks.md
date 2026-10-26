# Tasks

## 1. Contract and RED

- [x] 1.1 `ai-provider.draft-service.test-queue.test.ts`: controls for created and queued executions, RED for an already running execution (audit)
- [x] 1.2 `ai-provider.repository.executions.test.ts`: control for a matching suite version, RED for a different suite version in the collision fallback

## 2. GREEN (after Root GO)

- [ ] 2.1 Audit and enqueue only when `created || queued` (`ai-provider.draft-service.ts`)
- [ ] 2.2 Select `testSuiteVersion` in the fallback and rethrow on mismatch (`ai-provider.repository.executions.ts`)

## 3. Native / DB evidence (separate windows, not claimed)

- [ ] 3.1 C0890/C0912 running state with a terminal or absent job; C0935/C0946 controlled interleavings; C0937 SQL and concurrent drafts; C0939 equal `requestedAt`; C0956 overlapping suite versions; C0958 high execution count

## 4. Verification

- [ ] 4.1 `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the final reviewed tree
