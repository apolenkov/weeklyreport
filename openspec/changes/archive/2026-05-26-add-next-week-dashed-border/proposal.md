# Add next-week dashed border

## Problem

Next-week item cells on the lead dashboard render with a solid border, the same
as current-week cells. User expects a dashed border to visually distinguish
future items from immediate ones.

## Solution

Apply a dashed border style to item-row cells for next-week items. Preserve the
current-week solid border style.

## Non-goals

- Change item spacing, padding, or color scheme.
- Add icons or text labels for week distinction (border is sufficient).
- Modify the item data model.

## Source

User report: "ячейки для следующей недели — граница пунктирная. Почему упустил?"
Phase 61+ visual consistency task.

## Activation trigger

(Active — quick visual polish for next release.)
