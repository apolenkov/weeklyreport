## 1. Shared contracts and persistence

- [x] 1.1 Remove `answerProtocol` and `featureCompatibility` from shared AI provider schemas, types, read models, fixtures, and UI-facing result contracts.
- [x] 1.2 Replace prompt/provider compatibility persistence with provider-test-only execution data in the Prisma schema and init migration; regenerate Prisma and remove unused compatibility enums/models.
- [x] 1.3 Update provider identities and test-result persistence so the fixed answer contract is part of code, not a stored protocol selector.

## 2. API provider and prompt lifecycle

- [x] 2.1 Reduce the asynchronous provider queue/processor to provider tests only and remove prompt synthetic evaluation, compatibility services, and dead prompt execution methods.
- [x] 2.2 Make provider and prompt activation compare-and-set failures throw conflicts inside their transactions.
- [x] 2.3 Make queued execution requests re-enqueue an existing queued provider test and prompt lifecycle no longer create compatibility jobs; claim only `queued` executions.
- [x] 2.4 Move the Prisma runtime-configuration repository to the infrastructure layer and remove duplicate/magic dependency-token wiring.

## 3. Runtime, UI, and dead code cleanup

- [x] 3.1 Simplify OpenAI-compatible answer/transport contracts to the fixed structured-answer protocol and remove JSON Schema fallback/negotiation plumbing.
- [x] 3.2 Bound runtime client caching and remove unreachable Mistral adapters, dependency, and stale bootstrap/runtime references.
- [x] 3.3 Replace the lead Chat availability fallback with the typed tRPC query and update fixtures to verify fail-closed loading/error states.
- [x] 3.4 Remove duplicate exports, obsolete UI compatibility/protocol displays, and fix documented bootstrap environment loading.

## 4. Verification and durable documentation

- [x] 4.1 Update durable AI provider, prompt management, lead assistant, directory architecture, and related documentation to match the simplified behavior.
- [x] 4.2 Add focused regression tests for fail-closed availability, activation conflict rollback, queue recovery, duplicate running claims, and bounded runtime cache.
- [ ] 4.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm depcruise`, and `pnpm lint:md`; inspect the final diff and working tree.
