# Tasks

Reconciled 2026-11-02 against main 9d8051cc0 (implementation commits
9a793ff8e, 42514c419, d15781071, 60bfa4814).

## shared

- [x] 1. Spike: pin the latest stable `@dnd-kit/core` in `apps/web` and
      smoke-test Overview drag against React 19 / React Compiler before
      feature work (design decision validation, no product behaviour).
      Pinned 6.3.1 (9a793ff8e); drag verified in the browser on the lane-A
      stand before 60bfa4814.
- [x] 2. Next→Current placement-only move: the web `buildMoveItemPatch`
      (`lead-item-actions.ts:85-101`) serves both directions, preserves every
      saved field including `stableId` and `carriedOver` (see design), and
      returns no patch when the target week already holds the same lineage
      (`lead-item-actions.test.ts` "returns no patch for a retry or an
      existing target lineage").
- [x] 3. Description-only inline edit validation: the editor trims and
      restores empty text (`status-overview-item-text-editor.tsx:36-38`); the
      draft save boundary already rejects empty and invisible-only item text
      through `safeText()` on `itemWriteSchema.text`
      (`report.invisible-text.test.ts`), so no separate check is added.

## api

- [x] 4. Service tests for both placement directions and a round trip through
      `saveDraft` → `saveSection` keep `stableId`, text and progress
      (`report-sections.week-move.test.ts`, f6615383b). The draft save has no
      server-side duplicate-`stableId` check; the web `buildMoveItemPatch`
      refuses a move into an existing lineage (task 2). The atomic
      `periodState`/lifecycle-tuple update stays with task 13.

## web

- [x] 5. DnD layer with `@dnd-kit/core` (pointer distance 6, touch delay 200):
      `status-overview-dnd.tsx`, `status-overview-lane.tsx`,
      `status-overview-item-chip.tsx`; Previous inert via `resolveDrop`.
- [x] 6. Icon cluster with accessible names: week move, ✎ canonical editor,
      comment flow (`status-overview-item-icons.test.tsx`). Touch visibility is
      browser-checked only.
- [x] 7. `Alt+ArrowRight` / `Alt+ArrowLeft` (`status-overview-item-preview.tsx`
      `handleWeekMoveKey`; `status-overview-item-icons.test.tsx`).
- [x] 8. Inline text editor: Enter, Esc, Shift+Enter, blur saves, empty
      restores (`status-overview-item-text-editor.test.tsx`).
- [x] 9. Move notification with Undo; refused Undo reports
      `UNDO_UNAVAILABLE`; Undo survives a row-id re-issue
      (`overview-in-place-move.test.ts`, d15781071).
- [x] 10. Stale-tab handling after a move: a 409 on the move autosave reloads
      the saved placement and shows the "changed elsewhere" reload notice
      (`lead-status-overview.test.tsx` "reloads the saved placement when a
      move autosave hits a stale-tab conflict", addc85847).
- [x] 11. Component tests: editor state machine, icons by placement, shortcut
      applicability, Undo refusal, Previous ineligibility and rejected-drop
      card position (`status-overview-dnd.test.tsx`, addc85847).

## planning + docs

- [x] 12. E2E scenario (agent-browser) with durable evidence: icon move,
      drag Next→Current, Alt+Arrow round trip, inline edit with empty restore
      and Esc, Undo with reload, Previous read-only — all PASS on lane A,
      02.11; evidence in `~/work/handoffs/wr-766-e2e-20261102/RESULT.md`.
- [x] 13. Six gates ran green on each delivered SHA (60bfa4814 and later).
      Guarded API integration `week-move.integration.test.ts` passed 3/3 on
      `weeklyreport_e2e_lane_a_test` (02.11): both directions persist with one
      row per `stableId`, and a stale version is refused with `CONFLICT`.

## acceptance review fixes (Astra, 02.11)

- [x] 14. Undo is refused once the moved occurrence was edited: the move keeps
      a snapshot of the moved row and Undo compares it without the row id
      (`overview-in-place-move.test.ts`, d7efe11b3).
- [x] 15. A stale autosave (409) forces the next server delivery to replace
      the draft even when only the version moved
      (`use-lead-form-server-sync.conflict.test.tsx`, b9ea18f44). Submit and
      outcome 409 paths keep the existing conflict flow.
- [x] 16. Touch drags arm only through the long-press sensor on the drag
      handle; mouse and pen keep the distance threshold
      (`status-overview-dnd.test.tsx`, bc060bd6f).
