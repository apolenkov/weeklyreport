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
stamped from a payload that the mutation actually confirmed. The drain MUST send
the queued payload to the section it was built for (the queued payload's own
`reportSectionId`, captured at queue time), and MUST NOT override it with the
latest `reportSectionIdRef.current`, so that navigating reports or periods while
a save is in flight can never write a queued payload to a different section.

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

#### Scenario: report or period switches while a save is queued

- **GIVEN** a payload for section A is queued behind an in-flight save (the lead
  kept editing while a save for section A was in flight)
- **WHEN** the lead navigates to a different report or period before the
  in-flight save resolves, so `reportSectionIdRef.current` now points at
  section B
- **THEN** the `onSuccess` drain fires the queued payload against section A (its
  own captured `reportSectionId`), never section B
- **AND** no section-B section ever receives section A's queued content

### Requirement: Confirmed-save baseline stamp is scoped to the in-flight section

The autosave hook MUST stamp `lastSavedRef` from a resolved `saveDraft` only
when that save's section is still the section the hook currently targets. The
hook MUST capture the in-flight save's `reportSectionId` at mutate time
(alongside `inFlightRef`) — this is the section the mutation was actually sent
to, i.e. the queued payload's own `reportSectionId` on the drain path and
`reportSectionId` on the debounce/`forceSave` path, never a later
`reportSectionIdRef.current`. In every `onSuccess` (including a drained queued
save), the hook MUST compare the captured in-flight section id to the current
`reportSectionIdRef.current`; when they differ — the lead navigated to another
report or period before the in-flight save resolved — the hook MUST NOT stamp
`lastSavedRef` and MUST NOT schedule a save for the newly loaded section, so the
freshly-primed `initialSavedKey` baseline for the new section is preserved and
the new section does not falsely read `dirty`. A legitimately queued payload for
the still-current section MUST still stamp and drain as before; the guard skips
only the cross-section stamp and its spurious follow-up save, never a same-section
save.

#### Scenario: an old-section save resolves after navigation

- **GIVEN** a `saveDraft` for section A is in flight and the lead has made no
  further edits (nothing is queued)
- **WHEN** the lead navigates to a different report or period (section B),
  priming `lastSavedRef` from section B's `initialSavedKey`, and only then does
  the section-A save resolve and run its `onSuccess`
- **THEN** the hook does not overwrite section B's baseline `lastSavedRef` with
  section A's confirmed key
- **AND** section B does not read `dirty` and no spurious autosave is scheduled
  for section B

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
