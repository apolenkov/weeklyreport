# Preserve the users delete confirmation while pending

## Why

Confirming Delete on the admin Users tab closed the confirmation instantly
while the `admin.deleteUser` request was still in flight. The admin lost the
pending context and the dialog offered no guard against dismissal or a
duplicate submit during the request.

## What Changes

- Keep `ConfirmDeleteDialog` mounted for the pending delete by passing its
  existing `isPending` guard (`deleteUserMut.isPending`).
- Remove the synchronous close after `mutate`; close the confirmation on
  settlement — success or failure — through the per-call `onSettled` mutation
  callback, preserving the existing success and error notifications.
- While pending, Confirm, Cancel, Escape, and overlay dismissal stay inert and
  no duplicate delete request can be issued.

### Non-goals

- No changes to the shared `ConfirmDeleteDialog` or `useUserMutations`
  implementations.
- No pending-close wiring for the other `ConfirmDeleteDialog` callers
  (products, groups, activities, jobs, review and report surfaces).
- No retry affordance inside the failed dialog; failure closes it and keeps
  the error toast.

## Impact

- Affected spec: `admin-dialog-focus-management` (new pending-delete
  requirement).
- Affected code: `apps/web/src/features/admin/ui/use-users-tab-state.ts`,
  `apps/web/src/features/admin/ui/users-tab.tsx`, and the co-located users tab
  test.
- No schema, API, or environment configuration changes.
