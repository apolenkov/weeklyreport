## 1. Planning and Instruction Contract

- [x] 1.1 Validate the change and its `developer-ui-feedback-tooling` delta with `pnpm exec openspec validate standardize-onui-ui-review --strict`.
- [x] 1.2 Add one concise onUI section to WeeklyReport `AGENTS.md`; verify it names the canonical origin, Standard read path, ID traceability, ambiguity handling, and evidence-bound closure without duplicating installation details.

## 2. Local onUI Acceptance

- [x] 2.1 Verify the pinned user-level `onui-local` registration, native host manifest, and writable local store without adding repository dependencies.
- [ ] 2.2 On `http://localhost:3000`, create one disposable annotation, read it through MCP, trace it to its rendered target, update it only after verification, and remove it; require zero residual test annotations. Current status (2026-09-16): open. The retained historical roundtrip evidence below does not establish a current WeeklyReport MCP roundtrip.
- [x] 2.3 Read back the existing Development onUI contract and canonical `http://127.0.0.1:4177` page without modifying its dirty worktree or annotation state.

## 3. Legacy Local Agentation Tooling Retirement

- [x] 3.1 Inventory legacy user-level Agentation processes, MCP configuration, launch services, global packages, and local SQLite consumers; distinguish them from WeeklyReport's active product integration and historical documentation.
- [x] 3.2 Resolve `~/.agentation` immediately before deletion, prove it contains only the known SQLite store files, then delete that exact directory without backup or import as explicitly authorized by the owner.
- [x] 3.3 Prove `~/.agentation` is absent and the legacy user-level runtime inventory is empty while WeeklyReport's active product integration and historical repository evidence remain unchanged. This item covers Agentation retirement only; it does not close the WeeklyReport onUI roundtrip in 2.2.

## 4. Verification

- [ ] 4.1 Run `pnpm format:check`, `pnpm lint`, and `pnpm spec:check`; require every command to pass. Current status (2026-09-16): `pnpm spec:check` reaches strict OpenSpec validation (173/173 passed) but fails in `pnpm spec:reticle` with `Error: invalid deterministic proof` at `scripts/gates/reticle-spec-coverage.ts:177`; this is not a PASS.
- [x] 4.2 Audit the final diff: only WeeklyReport agent guidance and the linked OpenSpec changes may change; no product dependency, product bundle, Development dirty file, archive, onUI source, or product lifecycle contract may change.

## Verification Evidence

- The completed inventory and environment statements below are historical
  evidence from this change; this specification reconciliation did not refresh
  them, and they MUST NOT be treated as a current runtime snapshot.
- Historical roundtrip evidence (2026-09-14): `standardize-onui-ui-review-roundtrip.json` records the registered server driven over stdio JSON-RPC (`initialize` + `tools/list` + `tools/call`, 8 tools); a disposable annotation was created through the native host's Chrome native-messaging `UPSERT_PAGE_SNAPSHOT` path, read through `onui_get_annotations`, traced to the single rendered `h2[data-overview-focus-heading="true"]` (identical bounding box; the React-generated DOM id is not stable), updated through `onui_update_annotation_metadata`, read back, and removed with `onui_delete_annotation`. MCP and the store ended empty (pages 0, annotations 0), and the Development page and worktree were untouched.
- Current status (2026-09-16): the WeeklyReport disposable annotation roundtrip remains open because the current MCP surface has no create operation and the database-backed app was not started without fresh disposable-database consent; this keeps 2.2 unchecked.
- Both linked changes passed strict validation immediately after creation.
- The exact legacy local Agentation deletion target contained only `store.db`, `store.db-shm`, and `store.db-wal`; after explicit deletion, the directory is absent and the user-level process, MCP/config, global-package, and SQLite-consumer inventories are empty.
- Historical Agentation references under Development `delivery/` remain untouched.
- Historical gate evidence (2026-09-11): `pnpm format:check`, `pnpm lint`, and `pnpm spec:check` passed after staging the scoped change set for the repository-cleanliness denominator. The current 2026-09-16 `spec:check` result is recorded above and supersedes that PASS for present status.
- `onui-local` is enabled at the pinned v2.2.3 entrypoint; the Chrome native host is executable, the local JSON store is writable, and MCP Standard reports are readable. The Development contract and live `http://127.0.0.1:4177/analytics-process-sdd.html?feedback=1` page were read without mutation.
