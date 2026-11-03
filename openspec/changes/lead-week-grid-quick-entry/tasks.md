# Lead week grid quick entry implementation plan

**Goal:** Let a Lead quickly enter work in its Product/Activity and week while preserving detailed editing, prior history and canonical saves.

**Architecture:** The Overview owns contextual presentation; the Lead shell alone owns draft mutation, per-record save receipts and recovery. Reuse existing status/rollover/verdict and record builders; show authorized comments in an explicit viewing region.

**Tech stack:** TypeScript, React/Next, tRPC, shared Zod schemas, Vitest, agent-browser. **Spec:** `openspec/changes/lead-week-grid-quick-entry/specs/` and `design.md`.

## Global constraints

- Preserve Product versus Activity parent and current stage ownership; no fabricated required fields or silent defaults.
- Previous snapshots are read-only; preserve stableId, rollover precedence, lifecycle and canonical permissions.
- Keep active owner-preview worktree, ports, browser session and data untouched; verify changes in an isolated, provisioned lane.
- Save, retry and discard are generation- and record-identity aware; no lost typed text, false success, stale overwrite or duplicate save.
- UI strings are English, keyboard/touch reachable and preserve the existing design system.

## Review focus

1. Two same-text records with different IDs remain distinct; retry cannot duplicate the same ID.
2. Parent/stage ownership or section capability changes while entry is open: retain input and block invalid write.
3. Failure after a local patch then discard/retry: later saves cannot resurrect abandoned input.
4. Existing prior plan has Current or Next continuation: reuse correct lineage without mutating the frozen source.
5. 375px, keyboard, focus, sticky-header and no-comments states are understandable and actionable.

## Work packages

- [ ] 1. Reconcile all conflicting existing OpenSpec scenarios for creation with the four delta specs. Confirm the separate global toolbar flows and modal detailed-edit requirements remain intact. Verify strict validation and record the owning write-path scenarios before implementation.
- [ ] 2. Establish the shell-owned typed contextual-create contract and receipt/recovery strategy in `apps/web/src/features/report-pages/ui/lead/shell/` using existing draft machinery. Add failing tests for record-specific receipt, stable retry ID, pending/dirty arbitration, generation/lifecycle/ownership changes, failed-patch discard and conflict; implement and rerun them. Keep shared integration files under this one owner.
- [ ] 3. Replace unit-header Add item with one accessible inline create action per Current/Next unit context in `apps/web/src/features/report-sections/ui/status-overview-*`. Add failing empty/populated, Product/Activity, Next Planned, mobile/keyboard, no-Previous-add and canonical pencil tests; implement with the contract from 2 and rerun. Preserve current title inline-edit and move controls.
- [ ] 4. Add compact contextual Product/Activity risk and decision entry under their existing feature owners. Reuse or extract `risk-edit-dialog-helpers.ts` and `decision-edit-dialog-helpers.ts`; test required fields, author, eligible stages, stage-less Activity, owner changes, failure and typed valid output. Integrate with shell's own-list patch and record-specific receipt from 2; do not write foreign rows or treat filtered incomplete data as saved.
- [ ] 5. Make the item comments action visibly reveal a named authorized comment region or an honest empty state. Add failing pointer/keyboard/focus, existing comments, no-comments and foreign/privacy tests; implement in `status-overview-item-row.tsx`, `status-overview-item-preview.tsx`, `status-overview-record-comments.tsx` and colocated tests. Keep Lead reply authorization unchanged unless the owner explicitly chooses it.
- [ ] 6. Verify existing Previous-plan verdict, Current/Next movement, rollover and frozen-history integration using the owning `lead-plan-verdict`, `lead-overview-week-moves`, `tracked-work-continuation` and shared draft/persistence scenarios. Add targeted tests only for missing requirements. Verify identity, no duplicate and no silent conflict or mutation of previous snapshots.
- [ ] 7. Integrate reviewed candidates with one owner for shared props/barrels, validate OpenSpec, run targeted tests and the six required root gates. Run guarded DB integration and full E2E when required by actual write-path changes. Capture and inspect 1280/375 browser evidence on the implemented tree and separate lane, with source/DB/Redis verified; check keyboard, focus, retry, draft continuity, parent ownership and no horizontal overflow.
- [ ] 8. Obtain independent high-effort final review of the implemented tree, resolve findings, revalidate the change and archive only after acceptance. Record SHA, results and outstanding limits in TASK-836. Commit in the task-owned branch; push only within the owner's authorized delivery scope.
