# Design: Direct Move to Next in Lead Status Overview (TASK-766 / TASK-707 p10)

## Context

In `use-overview-openers.ts`, `moveItem` handles moving an item between weeks in the Overview view.
Currently:

1. `acknowledgeSavedNextWeekPlan`: if the item already carries a saved next step, it directly applies `buildNextWeekPlanAcknowledgementPatch` to `editor.draft`, displays `toast.success("Already planned for next week")`, and returns without opening the editor (2 clicks: `…` → `Move to next week`).
2. Otherwise, it calls `openEditItem(item.editTarget, target, ...)`, which opens the canonical inline modal editor, requiring the user to click `Save update` (3 clicks).

## Solution

In `moveItem` in `apps/web/src/features/report-pages/ui/lead/shell/use-overview-openers.ts`:

- Only for target `next` (Move to this week keeps the editor): check whether the item can be directly moved using `buildMoveItemPatch(editor.draft.section, recordId, target)`.
- If `buildMoveItemPatch` produces a valid patch, execute the move directly using `whenIdle`:
  - Derive the fresh patch against `ready.draft.section`.
  - Apply the patch: `ready.draft.apply(patch)`.
  - Announce success via `toast.success("Moved to next week")`.
  - Return early without opening `openEditItem`.
- If the direct move cannot be built (a saved next step is handled by the acknowledgement path first; a Next occurrence of the same `stableId` already exists; the item is finished), fall back to `openEditItem` so the lead can review or edit.
- Click cost (TASK-707 scenario 10, `base707-RESULT.md`): `…` → Move to next week → Save update = 3 clicks before; `…` → Move to next week = 2 clicks after.
- Invariants:
  - Rollover invariants: `buildMoveItemPatch` enforces `hasOtherPlacement` check ensuring at most one active W+1 item per `stableId`.
  - Previous remains read-only.
  - Draft autosave atomically debounces and commits the change.
