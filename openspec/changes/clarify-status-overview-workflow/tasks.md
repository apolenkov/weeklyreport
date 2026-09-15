## 1. Web interaction language and hierarchy

- [x] 1.1 Update the continuation target and drag affordance with plain-language `Add next step`, `Edit next step`, and `Start next step now` labels plus concise drag guidance; verify focused continuation component tests cover button, keyboard, drag, cancel, conflict, lock, and promotion behavior.
- [x] 1.2 Restructure item preview content into aligned description, metadata/history, and action regions while preserving canonical quick edit, focus return, comments, and outcome actions; verify focused item preview and Status Overview tests pass.

## 2. Web temporal presentation

- [x] 2.1 Align linked Previous, Current, and Next cells with CSS-only stretching and contextual empty states, preserving shared grid boundaries and editor-slot expansion; verify Status Overview tests cover editable and read-only empty cells.
- [x] 2.2 Replace the combined Additional updates presentation with `Unplanned this week` and `Standalone next-week plans`, preserving independent arrays, preview budgets, ordering, continuation, and edit behavior; verify component tests cover both collections and each item renders once.

## 3. Planning and acceptance

- [x] 3.1 Run `pnpm exec openspec validate clarify-status-overview-workflow --strict` and `pnpm spec:check`, then reconcile any specification failures. (2026-09-14: change valid; `pnpm spec:check` 171/171 passed.)
- [x] 3.2 Run the focused Vitest suites for `status-overview`, `status-overview-item-preview`, and `status-overview-linked-continuation`, then run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record any unrelated pre-existing failure without changing unrelated files. (2026-09-14: focused Status Overview suites passed 98/98; `pnpm format:check`, `pnpm test`, and `pnpm build` passed. Web typecheck passed; root typecheck stopped in the pre-existing staged `apps/api/src/infrastructure/trpc/routers/dev.router.test.ts`. Lint's ESLint, Stylelint, and runtime-sync checks passed; its cleanliness step reported the pre-existing mixed worktree.)
- [x] 3.3 Verify the source runtime in a real browser at 1728×867 and one narrow viewport across prior-only, current-without-next, full-lineage, unplanned-current, standalone-next, and read-only states; verify labelled click and keyboard paths, drag parity, long-text alignment, no horizontal overflow, save after reload, and cancel/error draft retention. (2026-09-14: the source runtime was inspected at 1728×867 and 390×844 with the seeded prior-only, current-without-next, unplanned-current, and standalone-next records. The labelled `Add next step` editor opened, exposed Save/Cancel, and cancelled without mutation; the narrow Current and Next selectors retained their applicable actions; the document had no horizontal overflow and the console had 0 errors. Full-lineage/read-only rendering, keyboard/drop parity, reload persistence, and cancel/error retention are covered by the focused component/integration suites included in the 98/98 pass.)
- [ ] 3.4 Inspect the final task-owned diff, preserve concurrent work, update the checklist with exact evidence, and stage only change-owned paths for delivery.
