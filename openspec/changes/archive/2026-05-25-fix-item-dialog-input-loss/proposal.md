# Fix item edit dialog input-loss bug

## Problem

In the item edit dialog, when a user starts typing immediately after opening
the dialog, the input clears unexpectedly. Likely cause: React Hook Form's
watch/reset race or a stale state closure.

## Solution

Ensure the dialog's form state initializes before user input can occur:

- Move form initialization to a `useEffect` that runs only once on mount.
- Guard input handlers against stale `formState` values.
- Consider a brief loader state to guarantee form is ready before the user
  can interact.

## Non-goals

- Redesign the dialog layout.
- Change the data-fetch strategy for item details.
