## 1. Operations Configuration

- [x] 1.1 Change `DLQFailuresActive` to threshold `cr_dlq_failed_current` and verify `promtool` accepts `deploy/alert-rules.yml`.
- [x] 1.2 Add a TypeScript repository gate for the named alert block and verify `node --import tsx --test scripts/gates/operations/operations-config-docs.test.ts` passes.

## 2. Specification and Acceptance

- [x] 2.1 Sync the authoritative-gauge requirement to the durable spec and verify the change with `openspec validate use-authoritative-dlq-alert-gauge --strict`.
- [x] 2.2 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` on the completed change.
