## 1. Planning and Instruction Contract

- [x] 1.1 Validate the change and its `developer-ui-feedback-tooling` delta with `pnpm exec openspec validate standardize-onui-ui-review --strict`.
- [x] 1.2 Add one concise onUI section to WeeklyReport `AGENTS.md`; verify it names the canonical origin, Standard read path, ID traceability, ambiguity handling, and evidence-bound closure without duplicating installation details.

## 2. Local onUI Acceptance

- [x] 2.1 Verify the pinned user-level `onui-local` registration, native host manifest, and writable local store without adding repository dependencies.
- [x] 2.2 On `http://localhost:3000`, create one disposable annotation, read it through MCP, trace it to its rendered target, update it only after verification, and remove it; require zero residual test annotations. Current status (2026-09-30): done on the source run of this branch; see Verification Evidence.
- [x] 2.3 Read back the existing CoreDev onUI contract and canonical `http://127.0.0.1:4177` page without modifying its dirty worktree or annotation state.

## 3. Legacy Local Agentation Tooling Retirement

- [x] 3.1 Inventory legacy user-level Agentation processes, MCP configuration, launch services, global packages, and local SQLite consumers; distinguish them from WeeklyReport's active product integration and historical documentation.
- [x] 3.2 Resolve `/Users/wrk/.agentation` immediately before deletion, prove it contains only the known SQLite store files, then delete that exact directory without backup or import as explicitly authorized by the owner.
- [x] 3.3 Prove `/Users/wrk/.agentation` is absent and the legacy user-level runtime inventory is empty while WeeklyReport's active product integration and historical repository evidence remain unchanged. This item covers Agentation retirement only; it does not close the WeeklyReport onUI roundtrip in 2.2.

## 4. Verification

- [x] 4.1 Run `pnpm format:check`, `pnpm lint`, and `pnpm spec:check`; require every command to pass. Current status (2026-09-30): all three exit 0 on this branch (`~/.local/state/session-review/weeklyreport-20260929/openspec-fix/format-check.log`, `lint.log`, `spec-check.log`).
- [x] 4.2 Audit the final diff: only WeeklyReport agent guidance and the linked OpenSpec changes may change; no product dependency, product bundle, CoreDev dirty file, archive, onUI source, or product lifecycle contract may change.

## Verification Evidence

- The completed inventory and environment statements below are historical
  evidence from this change; this specification reconciliation did not refresh
  them, and they MUST NOT be treated as a current runtime snapshot.
- Historical roundtrip evidence (2026-09-14): `standardize-onui-ui-review-roundtrip.json` records the registered server driven over stdio JSON-RPC (`initialize` + `tools/list` + `tools/call`, 8 tools); a disposable annotation was created through the native host's Chrome native-messaging `UPSERT_PAGE_SNAPSHOT` path, read through `onui_get_annotations`, traced to the single rendered `h2[data-overview-focus-heading="true"]` (identical bounding box; the React-generated DOM id is not stable), updated through `onui_update_annotation_metadata`, read back, and removed with `onui_delete_annotation`. MCP and the store ended empty (pages 0, annotations 0), and the CoreDev page and worktree were untouched.
- Current status (2026-09-30): WeeklyReport roundtrip done on `http://localhost:3000/lead/report/a0000000-0000-4000-8000-000000000001` (annotation created on that exact page URL through the native host; MCP has no create tool). Raw MCP outputs in `~/.local/state/session-review/weeklyreport-20260929/openspec-fix/onui22/mcp-roundtrip.txt`: `onui_get_annotations` read, live trace of `h2[data-overview-focus-heading="true"]` (1 match, identical box, `trace-from-mcp.json`, `target.png`), `onui_update_annotation_metadata` to resolved with `expectedUpdatedAt`, re-read, `onui_delete_annotation` (`remainingOnPage: 0`); afterwards MCP lists no localhost page and the CoreDev page is unchanged.
- Both linked changes passed strict validation immediately after creation.
- The exact legacy local Agentation deletion target contained only `store.db`, `store.db-shm`, and `store.db-wal`; after explicit deletion, the directory is absent and the user-level process, MCP/config, global-package, and SQLite-consumer inventories are empty.
- Historical Agentation references under CoreDev `delivery/` remain untouched.
- Historical gate evidence (2026-09-11): `pnpm format:check`, `pnpm lint`, and `pnpm spec:check` passed after staging the scoped change set for the repository-cleanliness denominator. The current 2026-09-16 `spec:check` result is recorded above and supersedes that PASS for present status.
- `onui-local` is enabled at the pinned v2.2.3 entrypoint; the Chrome native host is executable, the local JSON store is writable, and MCP Standard reports are readable. The CoreDev contract and live `http://127.0.0.1:4177/analytics-process-sdd.html?feedback=1` page were read without mutation.
