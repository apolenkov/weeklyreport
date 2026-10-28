# Proposal

## Why

np-2 verification reproduced and confirmed defect 503.38 (same-tick double-submit):
a rapid double-click or same-tick repeated submission of the review comment form
bypasses React's asynchronous `isPending` state update before re-render, causing
`trpc.review.comment` to be called twice in the same batch or tick. This produces
duplicate review comment entries in the database.

A synchronous ref guard (matching repo standard pattern `inFlight` / `busyRef`)
is required in `useRecordCommentState` to discard repeated submit calls while a
submission is already in flight.

Backlog: TASK-503.38.

## What Changes

- Add a synchronous ref guard (`busyRef` / `inFlightRef`) to `useRecordCommentState`
  that flips to `true` synchronously on submit before mutation call.
- Synchronously block repeated calls to `submitDraft` while `inFlightRef.current` is true.
- Reset the ref guard when the mutation settles (or on error / comment added).
- Add unit test verifying that two same-tick submit calls result in exactly one mutation call.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `record-comment-save-coordination`: review comment submission synchronously prevents same-tick duplicate submissions.

## Impact

- `apps/web/src/features/review/ui/comments/use-record-comment-state.ts`
- `apps/web/src/features/review/ui/comments/record-comments.test.tsx`

## Non-goals

- No change to the shared review schema or backend review mutations.
