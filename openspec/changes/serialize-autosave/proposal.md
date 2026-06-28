## Why

A lead editing a section can silently lose edits and see a spurious error
toast. The autosave debounce timer fires a new `saveDraft` mutation without
checking whether a save is already in flight, so two mutations run in parallel
on a single in-flight slot. An earlier save's `onSuccess` then stamps
`lastSavedRef` with the newer payload key, flipping `dirty` to `false` before
the newer payload has actually confirmed — so a later failure or out-of-order
completion drops the user's most recent edits while the UI reads "saved". The
queued-save drain in `onSuccess` calls `void mutateAsyncRef.current(...)` with
no `.catch`, leaking an unhandled promise rejection that surfaces as a second,
spurious error report. The review backlog flags this P1
(`BL-AUTOSAVE-RACE`, `docs/repo-excellence-review-2026-06-28.md`).

## What Changes

- The debounce timer MUST serialize against the in-flight save: when a
  mutation is already pending it stashes the current payload key and snapshot
  into the existing `queuedKeyRef` / `queuedPayloadRef` and lets the
  `onSuccess` drain fire it, instead of spawning a second parallel mutation
  on the single in-flight slot. This mirrors the guard `forceSave` already
  applies.
- The queued-save drain MUST replace `void mutateAsyncRef.current(...)` with
  the fire-and-forget `mutateRef.current(...)` so the mutation's own
  `onSuccess` / `onError` handle the result and no unhandled promise rejection
  leaks.
- Behavior contract only — no schema, API, or shared-package change.

## Capabilities

### New Capabilities

- `lead-autosave-serialization`: the lead-form autosave hook serializes
  concurrent saves onto a single in-flight slot and never leaks an unhandled
  rejection from the queued-save drain.

### Modified Capabilities

<!-- None. lead-dialog-lifecycle governs dialog open/close structure, not
     autosave save-in-flight ordering; client-error-policy governs query LOAD
     failures through the error-policy seam, not mutation fire-and-forget. -->

## Impact

- `apps/web/src/hooks/use-lead-form-autosave.ts` — debounce-timer guard and
  queued-drain call site (the only behavioral edit).
- Relates to `openspec/specs/client-error-policy/spec.md` (the unhandled
  rejection is the same defect family) but does not change its requirements.
