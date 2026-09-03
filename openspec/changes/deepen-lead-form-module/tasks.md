## 1. Shared and API Contract Preservation

- [x] 1.1 Preserve `packages/shared`, `apps/api`, Prisma, and tRPC contracts unchanged; verify the final diff contains no files in those paths.

## 2. Web Write Seam

- [x] 2.1 Add the declared `LeadFormWritePort` and production tRPC adapter for save, submit, fill-from, revoke, and reopen; verify focused adapter tests preserve success invalidations, pending states, and normalized conflict/error outcomes.
- [x] 2.2 Add an in-memory test adapter with controllable results and recorded calls; verify its unit tests cover success, conflict, generic failure, and pending state.
- [x] 2.3 Inject the write port into autosave and submit without changing queue or optimistic-lock behavior; verify the existing autosave and submit suites pass.

## 3. Deep Lead Form Module

- [x] 3.1 Introduce the declared `LeadFormEditorHandle` and `useLeadFormEditor` external seam; verify no refs, React setters, TanStack mutation objects, or inferred sibling-hook return types appear in the interface.
- [x] 3.2 Move fill-from, revoke, reopen, submit-confirmation, and quick-add orchestration behind the editor interface; verify existing generation, conflict, dialog, and quick-add tests pass.
- [x] 3.3 Add one deterministic characterization test through `LeadFormEditorHandle` using the in-memory adapter for quick-add, save, conflict, and submit sequencing.

## 4. Web Callers and Test Surface

- [x] 4.1 Switch `LeadForm` to the editor interface and remove obsolete orchestration glue and exports; verify repository searches find no caller access to version refs, internal setters, or mutation objects.
- [x] 4.2 Narrow loaded-rendering inputs to declared state and command slices; verify affected rendering and Lead Form characterization suites pass.
- [x] 4.3 Remove only tests made redundant by external-seam coverage while retaining independent domain tests; verify affected web coverage does not regress below configured thresholds.

## 5. Planning and Verification

- [x] 5.1 Mark completed tasks and validate the change with `pnpm exec openspec validate deepen-lead-form-module --strict`.
- [x] 5.2 Run focused Lead Form tests and record the exact passing command in this change.
- [x] 5.3 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check`; require every command to pass.
- [x] 5.4 Audit the complete final diff against baseline `9073c8e3143d0ef8b0b351c56c98c967d2e2ebc4`, confirming no user-visible behavior, UI strings, server contracts, shared schemas, database files, or backend files changed.

## Verification Evidence

- Focused Lead Form denominator: `pnpm --filter @customreport/web exec vitest run src/features/report-pages/ui/lead src/features/report-sections/model/autosave src/features/report-sections/model/lead-form src/features/period/model/use-lead-form-fill-from.test.tsx` — 45 files, 326 tests passed.
- Web coverage: `pnpm --filter @customreport/web test:coverage` — configured thresholds passed (88.96% statements, 82.79% branches, 88.54% functions, 90.6% lines).
- Repository gates: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check` passed.
- Final diff denominator: baseline `9073c8e3143d0ef8b0b351c56c98c967d2e2ebc4`; changed paths are limited to `apps/web` and `openspec/changes/deepen-lead-form-module`.
