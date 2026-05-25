# Redesign priority on items

## Problem

The current Priority section is a standalone area on the lead form that is
disconnected from the actual items. Users find little value in assigning a global
priority ranking when they want priority tied directly to each item.

## Solution

Attach priority as a property of each item (current and next week). Replace the
standalone Priority section with per-item priority selectors (e.g., icon buttons
or chevron badges within item rows).

## Non-goals

- Change the priority enum or severity levels.
- Add global priority overrides or sorting.
- Modify the Risk or Decision priority (if any).

## Source

User request: "какой смысл в приоритете? Давай присваивать приоритет именно
айтемам." Phase 61+ product feedback.

## Activation trigger

Activate when user explicitly requests per-item priority UX redesign or
when product roadmap confirms the pivot from global to item-level priority.
