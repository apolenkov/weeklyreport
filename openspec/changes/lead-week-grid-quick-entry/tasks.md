# Lead week grid quick entry implementation plan

**Goal:** Let a Lead quickly enter work in its Product/Activity and week while preserving detailed editing, prior history and canonical saves.

**Architecture:** The Overview owns contextual presentation; the Lead shell alone owns draft mutation, per-record save receipts and recovery. Reuse existing status/rollover/verdict and record builders; show authorized item discussions and allow Lead replies through a narrowly authorized server path.

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
- [ ] 2. The gate accepts and commits the exact discriminated presentation contract in `design.md`. Assign non-overlapping existing files to owners for the record identity data path, prior-plan verdict, autosave receipt/recovery, and Overview host/shell integration; no file has more than one active writer. Freeze the contract before starting presentation work. Add failing tests for stableId through builder→own-list merge→payload→server remint, exact captured request/receipt, same text with distinct lineages, generation and permission/stage change, retention of concurrent own edits, ambiguous same-version retry while the original remains in flight, preservation of newer typing, and scoped compensating cancellation. Implement using existing optimistic CAS and draft coordinator, then rerun. Do not introduce a parallel generic state framework or stale whole-list rollback.
- [ ] 3. Item presentation owner creates only `apps/web/src/features/report-sections/ui/status-overview-inline-item-form.tsx` and its colocated test against the frozen `ItemComposerProps`. First fail tests for owner/week label, Current/Next progress, required fields, directly selectable assigned-stage labels and singleton default, Add another shortcut, keyboard, errors and mobile; implement and rerun. No host, props, model, barrel, shell or shared-test edits.
- [ ] 4. Record presentation owner creates only `status-overview-inline-risk-form.tsx`, `status-overview-inline-decision-form.tsx` and their colocated tests against frozen `RiskComposerProps` and `DecisionComposerProps`. First fail tests for Product versus Activity, required fields, author, owned stages, changed eligibility, pending/error and typed callbacks; implement and rerun. No existing helper, model, host, barrel or shell edits.
- [ ] 5. Comments presentation owner creates only a new named comments-view component and its colocated test in `report-sections/ui`. Extend the comments view and existing row/preview wiring to show authorized discussion and a reply composer for the Lead on their own eligible item. Implement a narrowly scoped Lead server write with transactional ownership, current lifecycle and stable-lineage checks, preserving all reviewer-only permissions. Test valid reply, foreign or frozen rejection, retained failed input, refresh without clobbering draft, keyboard/focus and empty state; exercise guarded API integration and browser.
- [ ] 6. Verify existing Previous-plan verdict, Current/Next movement, rollover and frozen-history integration using the owning `lead-plan-verdict`, `lead-overview-week-moves`, `tracked-work-continuation` and shared draft/persistence scenarios. Add targeted tests only for missing requirements. Verify identity, no duplicate and no silent conflict or mutation of previous snapshots.
- [ ] 7. Integrate reviewed candidates with the integration owner for all existing files, shared props/barrels and tests; validate OpenSpec, run targeted tests and the six required root gates. Run guarded DB integration and full E2E when required by actual write-path changes. Capture and inspect 1280/375 browser evidence on the implemented tree and separate lane, with source/DB/Redis verified; check keyboard, focus, retry, draft continuity, parent ownership and no horizontal overflow.
- [ ] 8. Obtain independent high-effort final review of the implemented tree, resolve findings, revalidate the change and archive only after acceptance. Record SHA, results and outstanding limits in TASK-836. Commit in the task-owned branch; push only within the owner's authorized delivery scope.
