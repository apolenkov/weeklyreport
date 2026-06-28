## ADDED Requirements

### Requirement: Autosave debounce serializes against the in-flight save

The lead-form autosave hook MUST run at most one `reports.saveDraft` mutation
at a time (`useLeadFormAutosave` in
`apps/web/src/hooks/use-lead-form-autosave.ts`). When the debounce timer fires while a
save is already in flight (`saveDraftMut.isPending`), the hook MUST NOT spawn a
second mutation on the single in-flight slot; it MUST instead stash the current
payload key and payload snapshot into `queuedKeyRef` / `queuedPayloadRef` and
let the existing `onSuccess` drain fire the queued save after the in-flight save
resolves. This mirrors the guard `forceSave` already applies. The hook MUST NOT
overwrite `inFlightRef` while a save is pending, so `lastSavedRef` is only ever
stamped from a payload that the mutation actually confirmed.

#### Scenario: debounce fires while a save is in flight

- **GIVEN** a `saveDraft` mutation is in flight (`isPending` is true)
- **WHEN** the debounce timer fires for a newer payload
- **THEN** the hook stashes the newer payload key and snapshot into
  `queuedKeyRef` / `queuedPayloadRef` and starts no second mutation
- **AND** when the in-flight save resolves, the `onSuccess` drain fires the
  queued payload as the next single mutation

#### Scenario: a later save fails after an earlier one succeeded

- **GIVEN** edits continue while a save is in flight, so a newer payload is
  queued rather than sent in parallel
- **WHEN** the earlier in-flight save succeeds and its `onSuccess` runs
- **THEN** `lastSavedRef` is stamped only with the earlier confirmed payload
  key, never the newer unconfirmed one
- **AND** the newer payload's queued save still runs, so `dirty` does not flip
  to `false` for a payload that has not been confirmed

### Requirement: Queued-save drain does not leak an unhandled rejection

The queued-save drain in the autosave hook's `onSuccess` handler MUST fire the queued mutation through the fire-and-forget `mutateRef.current(...)`, never `void mutateAsyncRef.current(...)`, so the
mutation's own `onSuccess` / `onError` handle the outcome. It MUST NOT call
`void mutateAsyncRef.current(...)`, because the discarded promise rejects on
failure with no `.catch`, leaking an unhandled rejection that the client error
pipeline reports as a second, spurious error.

#### Scenario: a queued save fails

- **GIVEN** a queued save is drained from `onSuccess`
- **WHEN** that queued mutation fails on the server
- **THEN** the failure is handled by the mutation's own `onError` (one error
  toast, `state` set to `error`)
- **AND** no unhandled promise rejection is emitted from the drain call site
