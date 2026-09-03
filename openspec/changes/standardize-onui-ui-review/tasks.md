## 1. Planning and Instruction Contract

- [x] 1.1 Validate the change and its `developer-ui-feedback-tooling` delta with `pnpm exec openspec validate standardize-onui-ui-review --strict`.
- [x] 1.2 Add one concise onUI section to WeeklyReport `AGENTS.md`; verify it names the canonical origin, Standard read path, ID traceability, ambiguity handling, and evidence-bound closure without duplicating installation details.

## 2. Local onUI Acceptance

- [x] 2.1 Verify the pinned user-level `onui-local` registration, native host manifest, and writable local store without adding repository dependencies.
- [ ] 2.2 On `http://localhost:3000`, create one disposable annotation, read it through MCP, trace it to its rendered target, update it only after verification, and remove it; require zero residual test annotations.
- [x] 2.3 Read back the existing CoreDev onUI contract and canonical `http://127.0.0.1:4177` page without modifying its dirty worktree or annotation state.

## 3. Agentation Retirement

- [x] 3.1 Inventory active Agentation processes, MCP configuration, launch services, global packages, and active-repository imports; distinguish historical documentation from runtime.
- [x] 3.2 Resolve `/Users/wrk/.agentation` immediately before deletion, prove it contains only the known SQLite store files, then delete that exact directory without backup or import as explicitly authorized by the owner.
- [x] 3.3 Prove `/Users/wrk/.agentation` is absent and the active-runtime inventory is empty while historical repository evidence remains unchanged.

## 4. Verification

- [x] 4.1 Run `pnpm format:check`, `pnpm lint`, and `pnpm spec:check`; require every command to pass.
- [x] 4.2 Audit the final diff: only WeeklyReport agent guidance, the two linked OpenSpec changes, and the exact-pinned SitePing adapter dependency slice may change; no product bundle, CoreDev dirty file, archive, onUI source, or product lifecycle contract may change.

## Verification Evidence

- Both linked changes passed strict validation immediately after creation.
- Exact Agentation deletion target contained only `store.db`, `store.db-shm`, and `store.db-wal`; after explicit deletion, the directory is absent and process, MCP/config, global-package, and active-repository inventories are empty.
- Historical Agentation references under CoreDev `delivery/` remain untouched.
- `pnpm format:check`, `pnpm lint`, and `pnpm spec:check` passed after staging the scoped change set for the repository-cleanliness denominator.
- `onui-local` is enabled at the pinned v2.2.3 entrypoint; the Chrome native host is executable, the local JSON store is writable, and MCP Standard reports are readable. The CoreDev contract and live `http://127.0.0.1:4177/analytics-process-sdd.html?feedback=1` page were read without mutation.
- Disposable annotation round-trip on WeeklyReport remains open: the current MCP surface has no create operation and the database-backed app was not started without fresh disposable-database consent.
