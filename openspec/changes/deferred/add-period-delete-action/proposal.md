# Add period delete action

## Problem

There is currently no UI to delete periods. When a period is created in error
or is no longer needed, it cannot be removed without a database edit.

## Solution

Add a "Delete" button in the head's period management surface with a
confirmation dialog. The dialog should warn if the period is in-progress or
contains reports: "This period is open. Proceed anyway?" Deletion cascades to
associated reports and sections.

## Non-goals

- Add undo/restore functionality.
- Keep deleted periods in the archive (soft-delete not required).

## Impact

Destructive operation: must be gated by the destructive-db-guard pattern.
