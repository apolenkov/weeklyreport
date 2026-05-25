# Fix stage chip risk visual sync

## Problem

When a user switches a risk's stage chip (e.g., from "At Risk" to "Blocked") in
the risk edit dialog, the visual selection state does not update immediately,
creating a false impression that the action did not register.

## Solution

Ensure the stage-multi-select component re-renders immediately after mutation
and reflects the new selected stage in its visual highlight (color, border,
checkmark).

## Non-goals

- Redesign the stage multi-select UX or styling.
- Change the risk data model or persistence layer.
- Add new stage types.

## Source

User report: "переключаю на блокет в риске, не вижу что произошел селект того
что пометил." Phase 61+ visual feedback issue.

## Activation trigger

(Active — blocking visual confirmation of user action.)
