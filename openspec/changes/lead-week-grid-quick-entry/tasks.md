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
- Coordinate the incomplete-draft dependency's F1–F5 boundaries: published-decision Impact cannot be cleared; Fill From excludes private source drafts; incomplete deletion requires intent; nonauthor risk/decision comment create/delete denies while incomplete; current-role private reads apply across routes. Item-only replies and complete-record reviewer permissions remain unchanged; that dependency owns these guards, not a second implementation here.

## Review focus

1. Two same-text records with different IDs remain distinct; retry cannot duplicate the same ID.
2. Parent/stage ownership or section capability changes while entry is open: retain input and block invalid write.
3. Failure after a local patch then discard/retry: later saves cannot resurrect abandoned input.
4. Existing prior plan has Current or Next continuation: reuse correct lineage without mutating the frozen source.
5. 375px, keyboard, focus, sticky-header and no-comments states are understandable and actionable.

## Work packages

- [ ] 1. Reconcile all conflicting existing OpenSpec scenarios for creation with the delta specs of this change. Confirm the separate global toolbar flows and modal detailed-edit requirements remain intact. Verify strict validation and record the owning write-path scenarios before implementation.
- [ ] 2. The gate accepts and commits the exact discriminated presentation contract in `design.md`. Assign non-overlapping existing files to owners for the record identity data path, prior-plan verdict, autosave receipt/recovery, and Overview host/shell integration; no file has more than one active writer. Freeze the contract before starting presentation work. Add failing tests for stableId through builder→own-list merge→payload→server remint, exact captured request/receipt, same text with distinct lineages, generation and permission/stage change, retention of concurrent own edits, ambiguous same-version retry while the original remains in flight, preservation of newer typing, and scoped compensating cancellation. Implement using existing optimistic CAS and draft coordinator, then rerun. Do not introduce a parallel generic state framework or stale whole-list rollback.
- [x] 3. Item presentation owner creates only `apps/web/src/features/report-sections/ui/status-overview-inline-item-form.tsx` and its colocated test against the frozen `ItemComposerProps`. First fail tests for owner/week label, Current/Next progress, required fields, directly selectable assigned-stage labels and singleton default, Add another shortcut, keyboard, errors and mobile; implement and rerun. No host, props, model, barrel, shell or shared-test edits.
- [ ] 4. After the nullable contracts and transaction/projection protections in `../lead-incomplete-record-drafts/tasks.md`, record presentation owner creates only `status-overview-inline-risk-form.tsx`, `status-overview-inline-decision-form.tsx` and their colocated tests against the updated `RiskComposerProps` and `DecisionComposerProps`. First fail tests for one-action primary text capture, optional expanded details, null impact/mitigation, Product versus Activity, explicit severity, authoritative author, eligible stages, truthful incomplete receipt and strict section submit; implement and rerun. No existing helper, model, host, barrel or shell edits. Coordinate with that change's web owner: one writer per file, no duplicate implementation.
- [ ] 5. Comments presentation owner creates only a new named comments-view component and its colocated test in `report-sections/ui`. Extend the comments view and existing row/preview wiring to show authorized discussion and a reply composer for the Lead on their own eligible item. Implement a narrowly scoped Lead server write with transactional ownership, current lifecycle and stable-lineage checks, preserving all reviewer-only permissions. Test valid reply, foreign or frozen rejection, retained failed input, refresh without clobbering draft, keyboard/focus and empty state; exercise guarded API integration and browser.
- [ ] 6. Verify existing Previous-plan verdict, Current/Next movement, rollover and frozen-history integration using the owning `lead-plan-verdict`, `lead-overview-week-moves`, `tracked-work-continuation` and shared draft/persistence scenarios. Add targeted tests only for missing requirements. Verify identity, no duplicate and no silent conflict or mutation of previous snapshots.
- [ ] 7. Integrate reviewed candidates with the integration owner for all existing files, shared props/barrels and tests; validate OpenSpec, run targeted tests and the six required root gates. Run guarded DB integration and full E2E when required by actual write-path changes. Capture and inspect 1280/375 browser evidence on the implemented tree and separate lane, with source/DB/Redis verified; check keyboard, focus, retry, draft continuity, parent ownership and no horizontal overflow.
- [ ] 8. Obtain independent high-effort final review of the implemented tree, resolve findings, revalidate the change and archive only after acceptance. Record SHA, results and outstanding limits in TASK-836. Commit in the task-owned branch; push only within the owner's authorized delivery scope.
- [ ] 9. Fix the reproduced inline text conflict data loss using the `lead-form-draft-orchestration` scenario. Preserve a visible recoverable value after 409 and after either refetch ordering, show an honest unresolved state, retain unrelated authoritative edits, fence report generations and prevent unsafe stale replay. Verify with the focused regression, real integration and browser tests.
- [ ] 10. Restructure the Overview host to mockup v2.5 (`/Users/wrk/.claude/jobs/497993c2/tmp/v25/index.html`, read-only; design.md "Layout direction 11.12" and "Data gap"). Each sub-task starts with failing tests for its scenarios and ends with its check; the specs of this change control where the mockup's explanation blocks (still v2.4) disagree. Build the missing `packages/ui` pieces listed under Gaps in design.md first.
  - [ ] 10.1 Row model. Split `columns.previouslyPlanned` into `lastWeek` and `priorCommitments` (both read-only), and build rows `{ stableId, last, current, next, priorCommitment, answerState }` from the lineage by `stableId`; a repeated slot gets its own row and nothing is overwritten, rows are never matched by text. Touches `status-overview-lineage.ts` (`buildStatusOverviewLineage`) and `status-overview-items.ts` (`isPreviousPlanItem`, `buildStatusOverviewColumns`, `nextStepText` substitution). Check: unit tests for the `lead-status-overview` scenarios on rows (unrelated items never share a row, a new item has empty earlier cells, two records of one work in one week do not overwrite, a derived `Next step` row follows its record).
  - [ ] 10.2 Grid and tabs. One CSS Grid with a single column template, three equal columns, Product/Activity header above, no left rail; replace the four-track `STATUS_OVERVIEW_DESKTOP_GRID` and the per-row `TIMELINE_GRID`, and migrate the `repeat(4,…)` assertion in `status-overview.test.tsx`. Below 1087 px of table width show Tabs Last, This, Next with This open, Home/End and arrow keys, no horizontal scroll at 375 px, 44 px targets on coarse pointers. Check: component tests of the `lead-overview-responsive-shell` scenarios (threshold, tab keys); agent-browser measurements at 1280, 1728 and 375 (2 px column alignment, no overflow); drafts survive tab switches, resizing across 1087 px and collapsing a unit.
  - [ ] 10.3 Record line and status menu. Remove pencil, move arrow and per-record discussion buttons and the hover gutter; render text, stage label, status icon and a conditional discussion icon with the count. Status menus per context (unanswered plan; This week record; no status in Next week), with an impossible move kept in the menu, aria-disabled, with its reason. Check: component tests for the `lead-status-overview` and `lead-overview-week-moves` scenarios (menu contents, disabled reasons, touch reason message); accessible names asserted.
  - [ ] 10.4 In-place editor. Open on a click on the text with the order text, stage, Next step (This week only), Save and Cancel, More details (modal Sheet), Move…, Discussion (N), Delete; no save on blur, draft marked unsaved, `Discard changes?`; clickable stage label in place; the reduced editor for a derived `Next step`. Check: component tests for the `lead-status-overview-actions` scenarios, including blur keeps the draft, Escape and Cancel with changes, and keyboard order.
  - [ ] 10.5 Plans and answers. An unanswered plan is one non-editable line with the status icon; answers write the selected week's occurrence through the existing verdict and outcome commands; `Paused…` and `Won’t do…` ask one line of reason; remove the answer button group, `Confirm all as Continue`, the `from plan` badge and the `Planned last week` label; the `N plans to answer` link and the carried-record `Needs status` blocker. Re-check the target week before every answer, move and Undo; `Already planned in Next week` and `Already in This week` AlertDialogs. Check: tests for the `lead-plan-verdict` scenarios; prior snapshot compared byte for byte before and after.
  - [ ] 10.6 One Undo rule. Verdict, move, delete, entry and clear Undo as one canonical guarded command (none exists in `use-overview-verdict-actions.ts`), refused while saving, after a later change, while editing or while its discussion holds typed text, never overwriting newer text, including uncertain saves. Check: unit tests for the `lead-overview-save-safety` Undo scenarios, every refusal text and restore-without-overwrite.
  - [ ] 10.7 Entry line and unit header. One quiet entry line per unit and week (no fill, no resting border; Enter, Shift+Enter, Escape with Undo; blur saves when there is text; This week defaults to Done and exposes its status right after saving; Next week has no status; `needed to submit` marker); header `+ Risk or decision` and the `N risks · M decisions` disclosure with the list and the details Sheet; kind switch keeps text. Migrate the tests that assert unit-header Add and More actions. Check: tests for the `lead-contextual-quick-entry` scenarios, including a failed save keeping its text.
  - [ ] 10.8 Submit readiness and Sheets. One `Before you submit` list at the end of the report, each blocker routed to its expanded unit (today `lead-submit-readiness.ts` routes risks to generic `report-details`), `N to fix` on Submit; typed unsaved text, a stage-only change and a pending save counted per record block Submit and are never lost; Discard after a failed save restores the exact last confirmed state; Sheets for the full form, discussion and risk details; AlertDialogs for confirmations. Check: tests for the `lead-overview-save-safety` scenarios and for the `lead-item-comment-access` Sheet scenarios.
  - [ ] 10.9 Acceptance. Run the six root gates, `openspec validate lead-week-grid-quick-entry --strict` and the focused tests; compare 1280 and 375 captures of the implemented tree with the mockup in a separate lane; verify the unit-collapse and Move-with-next-step open points of design.md with the owner. Check: gate outputs and screenshots recorded in TASK-836.

## Status 2026-11-09

- Done: inline item form and shell integration; failed draft writes are classified as ambiguous (transport/5xx) or restricted (4xx) at the tRPC adapter; Save after an ambiguous failure re-sends the identical immutable request (`retrySameAttempt`), later typing stays in the editor for its own Save; Cancel after possible dispatch retries the original first and only then sends the compensating restoration at the settled state; a conflict answer freezes the original, reads the authoritative section and keeps the submitted input in the recovery region.
- Done (package 9, code and focused regression): after an autosave 409 the Lead's changed item text (against the failed save's base revision) is laid over the first newer authoritative section in either arrival order; unrelated server edits stay; the held draft reports an error and does not autosave until the Lead edits or saves.
- Done (package 5, projection): a derived Next shares its record's comments; a read-only presentation takes comments from the authoritative source, never the dirty editor.
- Done (package 5, MVP): the Overview comments view offers a reply composer on the Lead's own persisted items through `review.leadItemComment`; a 4xx keeps the text with an error, an uncertain result asks for a discussion refresh instead of resending; a confirmed reply re-reads the Overview and section. Browser-checked at 1280/375 on dev data. The discussion is read by the dedicated own-Lead `review.leadItemDiscussion` query (one repeatable-read snapshot, uniform unavailable denial, `no-store`), mounted only while the comments are open; a confirmed reply re-reads only that query, never the editor. Not built: the shared alias owner and read-invalidation ticket for two simultaneously open aliases.
- Done (package 5, discussion owner): one page-scoped store keyed by section and stable lineage holds the reply draft, its edit sequence and the single delivery attempt, shared by Current and derived Next and kept while the comments are closed; an acknowledgement clears only the unchanged draft; an unavailable result or FORBIDDEN/UNAUTHORIZED read hides messages and drops the draft, a transient read failure keeps the list with a note; an uncertain delivery survives reads, blocks Send and resends only through "Send again (may duplicate)" after a check; a resolved own item keeps its comments control. Covered by hook, store and view tests; not yet browser-checked.
- Done (package 9, browser): the autosave conflict recovery was reproduced on the dev stand and autosave resumes after the Lead dismisses the conflict.
- Open: discussion remainder (session/user teardown of the store, reply notice for a removed card, focus rules, SPA-navigation retention); incomplete-record dependency work (package 4); E2E; final independent review.

## Contextual record presentation

- The nullable contract and preparation boundary are reviewed and committed.
- Risk and decision forms focus primary text on mount, keep additional details
  behind an accessible disclosure, accept missing details, and retain controlled
  input when details close. Errors reveal the affected optional fields and keep
  them open after correction until the Lead explicitly collapses them.
- Product stages, explicit risk severity, authoritative author and stale-context
  errors remain visible; pending writes disable duplicate submission while Cancel
  still emits intent for the host to reconcile. Component checks cover these
  states. Record host integration, persistence receipts, cancellation recovery
  and complete browser journeys remain in packages 2 and 7.

The existing stored-draft ledger captures deletion intent by expected section
version and kept record identities. A later authorized read cannot add or remove
that intent from an uncertain retry, including when the initial read was absent.
Adapter tests compare the full outgoing request across both read changes and
verify that a new-version write derives its own intent. This is the transport
part of package 2; contextual host cancellation and guarded end-to-end acceptance
remain open.

## Contextual record host

The Overview now places the record form under its Product or Activity, without
an item week lane. The existing input provider retains the composer; the existing
draft engine applies identity-scoped creation, replacement and compensation.
Only a matching scoped receipt confirms the submitted record. Later typing stays
for a separate save; uncertain retries keep the original request and cancellation
waits for the original outcome before removing or restoring the unchanged lineage.
The existing stage memory observes these scoped patches only after persistence.

Own-save echoes reconcile against current state even when the render preceding
the read was clean, so a child applying a later edit or cancellation on the save
receipt cannot have that change replaced by the same-version read. Negative
receipt checks cover token, activation, version, exact lineage and absence in
both the dispatched payload and persisted response. Full acceptance remains in
packages 7 and 8; component and in-memory checks do not replace the guarded
browser and database journeys.
