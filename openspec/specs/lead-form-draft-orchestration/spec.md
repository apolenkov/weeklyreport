# lead-form-draft-orchestration Specification

## Purpose

Coordinate lead draft state and optimistic-lock versions through one tested hook that refetches and reports stale-version conflicts.

## Requirements

### Requirement: Lead form draft orchestration is isolated behind a tested hook

The lead report form at `/lead/report/[reportId]` MUST keep its server-section
draft mirror, stable draft payload, autosave baseline, stale-version conflict
handler, and optimistic-lock version owner behind a feature-local hook. The
hook MUST use the existing `sectionToDraftPayload` and `useLeadFormAutosave`
contracts, and it MUST NOT introduce new tRPC procedures, schemas, product UI
strings, or write endpoints. The hook MUST NOT silently discard unsaved local
edits (a dirty draft) on any reseed: when an incoming server section merely
echoes back the save that is (or was) in flight, a refetch triggered by the
hook's own autosave success MUST reconcile the optimistic-lock version
without replacing the local draft content the lead is actively editing; when
an incoming server section reflects a genuine external edit while the draft
is dirty, the hook MUST surface the existing conflict/reload toast rather
than swapping the draft content without warning. A clean (non-dirty) draft
may still be reseeded silently when clean.

#### Scenario: Fresh server data seeds the draft without marking it dirty

- **WHEN** `leadForm.byPeriod` loads a section for the lead edit form
- **THEN** the hook exposes that section as the local draft
- **AND** computes the autosave initial saved key from the server payload
- **AND** autosave treats the freshly loaded draft as already saved

#### Scenario: Same-payload refetch preserves local draft edits

- **WHEN** React Query delivers a new server section object whose stable draft
  payload is byte-identical to the last server payload
- **THEN** the hook MUST update the current optimistic-lock version
- **AND** MUST NOT replace the local draft mirror

#### Scenario: In-flight-save echo does not clobber keystrokes typed during the round trip

- **GIVEN** the lead is typing into a section and autosave has started saving
  an earlier snapshot of the draft
- **WHEN** the lead keeps typing before the save's success-triggered refetch
  resolves, and the refetched server section's draft payload differs from the
  last-seen server payload only because it echoes the in-flight save
- **THEN** the hook MUST NOT overwrite `draftSection` with the refetched
  server section
- **AND** the keystrokes typed during the round trip MUST remain present in
  the local draft
- **AND** the optimistic-lock version MUST still update from the refetch

#### Scenario: A genuine external edit reseeds a clean draft

- **GIVEN** the lead's local draft is NOT dirty (no unsaved edits)
- **WHEN** a refetched server section's draft payload differs from the
  last-seen server payload for a reason other than echoing the local
  in-flight save (for example another writer changed the section)
- **THEN** the hook reseeds `draftSection` from the server section as before

#### Scenario: A genuine external edit never silently clobbers a dirty draft

- **GIVEN** the lead has local unsaved edits in progress (dirty draft)
- **WHEN** a refetched server section's draft payload differs from the
  last-seen server payload for a reason other than echoing the local
  in-flight save (for example another writer changed the section)
- **THEN** the hook MUST NOT silently overwrite `draftSection` with the
  refetched server section
- **AND** the lead sees the existing conflict/reload toast (the same
  `handleConflict` path stale-version conflicts already use) so the
  overwrite is visible and explained, never a silent swap

#### Scenario: Server-assigned ids reconcile even when content reseed is suppressed

- **GIVEN** a save assigns a new server-side id to a client-temp record (for
  example a newly created item)
- **WHEN** the reseed is otherwise suppressed because the lead has unrelated
  unsaved edits
- **THEN** the newly assigned server id still reaches the local draft so a
  subsequent save references the real id

### Requirement: Optimistic-lock version stays current for every write consumer

The hook MUST own the lead section's current optimistic-lock version as both
React state and a synchronous ref. Autosave success, server refetch, submit, and
fill-from MUST all use the same current version source so no write replays a
stale closure.

#### Scenario: Autosave bump reaches submit

- **WHEN** autosave succeeds and the server returns a higher section version
- **THEN** a later submit from `LeadForm` MUST send that higher version

#### Scenario: Refetch-only version bump reaches fill-from

- **WHEN** a refetch changes only the server section version and not the stable
  draft payload
- **THEN** a later fill-from request MUST send the refetched version
- **AND** the version-only bump MUST NOT schedule an autosave by itself

### Requirement: Stale-version conflicts refetch and surface the reload message

The hook MUST expose the same conflict handler used by autosave, submit, and
fill-from. A stale-version conflict MUST refetch `leadForm.byPeriod` and show
the canonical form reload/error toast instead of silently discarding or marking local
edits saved.

#### Scenario: Submit conflict reloads the section

- **WHEN** the submit mutation reports a stale-version conflict
- **THEN** `leadForm.byPeriod` is refetched
- **AND** the lead sees the canonical form reload message

#### Scenario: Autosave conflict suppresses the generic autosave toast

- **WHEN** autosave reports a stale-version conflict
- **THEN** the conflict handler handles the refetch/message path
- **AND** the autosave hook MUST NOT also show the generic autosave failure toast

### Requirement: Transient editing actions are bound to one report generation

The `/lead/report` editor MUST key quick-add state, loaded context, and modal save callbacks by the current report and section identity. A callback captured for one generation MUST NOT read from or write to another generation.

#### Scenario: Navigation occurs with a quick-add modal open

- **WHEN** the user opens quick add for report A and navigation loads report B before the modal saves
- **THEN** the transient modal is closed or invalidated and saving it cannot mutate report B

#### Scenario: First loaded render after navigation

- **WHEN** report B becomes available on the first render after report A
- **THEN** every editor and quick-add callback receives report B's current context in that render and no previous-render ref is observable

#### Scenario: Stale callback is invoked directly

- **WHEN** a callback captured under report A is invoked after report B is active
- **THEN** the generation mismatch is rejected locally and no draft array is merged or autosaved

### Requirement: Overview create acknowledgement follows persisted identity

After an inline Overview create succeeds, the editor MUST recognize the
server-recreated Item as the submitted row and close the composer without
showing unsaved-input recovery. Recognition MUST require the canonical identity
mapping for that submission's temporary client id from the exact persisted
payload to a server id/stableId, the same authored fields, week and parent, the
same editor generation and save-receipt scope, a later receipt sequence, a newer
confirmed section version and the same submission attempt. Text equality alone
MUST NOT acknowledge a create.

Failure, conflict, ambiguous identity, generation replacement or later field
changes MUST retain the submitted input in the existing recovery flow and MUST
NOT overwrite the current draft.

#### Scenario: A successful create receives server identities

- **GIVEN** an Overview create holds a temporary client row id
- **WHEN** save succeeds and reconciliation replaces it with a server id and a new stableId
- **THEN** the matching submitted composer closes without unsaved-input recovery
- **AND** the current draft contains exactly one created row

#### Scenario: An apparent match lacks the attempt acknowledgement

- **WHEN** text matches another row but the stable identity, version, generation,
  successful-save timestamp or submission attempt does not confirm the create
- **THEN** the editor does not treat that text match as success
- **AND** the existing recovery input remains available without overwriting the draft

#### Scenario: An earlier identical create finishes first

- **GIVEN** create A is in flight and an identical Overview create B is queued
- **WHEN** A receives its server identity while B is still pending
- **THEN** A's receipt does not close B's composer
- **AND** a failure of B retains B's input for a retry without adding a duplicate
- **AND** only B's successful receipt may close B's composer

### Requirement: Asynchronous writes belong to one section activation

The lead draft engine MUST accept autosave and submit completions only for the
section activation that issued them. Leaving a section and returning to it MUST
create a distinct activation. Obsolete completions MUST NOT change the current
version, draft, saved baseline, submitted status or error recovery messages.

#### Scenario: A prior section's autosave settles while a new section has queued edits

- **GIVEN** section A has a pending autosave and section B is loaded with its own version and queued edits
- **WHEN** A's save succeeds or fails
- **THEN** B's queued payload is saved with B's current version
- **AND** A's result does not stamp B's baseline or show A's failure on B
- **AND** ordinary navigation to B is not treated as a conflicting external edit of A

#### Scenario: A queued request retains its original section after navigation

- **GIVEN** A has a pending save and another queued save before navigation loads B
- **WHEN** A's first save succeeds and the queued request has not been replaced
- **THEN** the queued payload is saved to A with A's confirmed version and identities
- **AND** neither completion changes B's draft state or version

#### Scenario: The user returns to a section before its old write settles

- **GIVEN** a write starts on A and navigation loads B and then A again
- **WHEN** the original A write settles
- **THEN** its completion cannot update the new A activation
- **AND** any current queued save retains the new activation's version and content

#### Scenario: Submit completes after navigation

- **GIVEN** submit starts on A and navigation loads B
- **WHEN** A's submit succeeds or fails
- **THEN** B retains its draft version and submitted status
- **AND** no submit success or error recovery is announced for B

#### Scenario: A current section's save succeeds

- **WHEN** an autosave succeeds for the still-current activation
- **THEN** its confirmed version and identities reconcile before the next queued save
- **AND** the existing same-section save-echo behavior is preserved

#### Scenario: Conflict recovery finishes after navigation

- **GIVEN** conflict recovery begins for A and navigation loads B before its refetch settles
- **WHEN** the refetch resolves or rejects
- **THEN** A's reload message is not announced on B

### Requirement: Overview plan completion MUST preserve newer retained input

An asynchronous Overview plan outcome or restore completion MUST close retained
input only when it belongs to the same item, editor generation, canonical
request input, command ID, and attempt owner recorded for that retained
composer. A success announcement MUST additionally require the completing
attempt owner to remain mounted. If the hook remounts and the retained fields
change or a newer attempt starts, an older completion MUST NOT close that
composer or announce success.

An unchanged explicit retry MUST retain its existing idempotent command ID.
Changing the canonical request input MUST create a new command identity, and
only that new attempt may close and announce its successful result. Existing
failure retention and unknown current-source recovery MUST remain unchanged.

#### Scenario: Old success arrives after retained input changes

- **GIVEN** an Overview plan command is pending when its route child remounts
- **AND** the lead edits the retained plan fields after the remount
- **WHEN** the old command succeeds
- **THEN** the edited retained composer remains open with the new input
- **AND** the obsolete hook owner does not announce success

#### Scenario: A newer changed attempt succeeds after the old attempt

- **GIVEN** a remounted composer contains changed canonical input
- **WHEN** the lead submits it while the old command is still unresolved
- **AND** the old command completes before the new command
- **THEN** the old completion does not close the new attempt
- **AND** the new attempt has a different command ID
- **AND** only the new completion closes the composer and announces success

#### Scenario: An unchanged retained prior-source request is retried

- **WHEN** a prior-source request is retained after an unknown acknowledgement
  and retried without field changes
- **THEN** the retry uses the original command ID and immutable source
- **AND** its successful completion closes the matching composer

#### Scenario: A current-source attempt remounts with an unknown outcome

- **WHEN** a current-source attempt owner changes before its outcome is known
- **THEN** the existing recovery block prevents another write
- **AND** the retained input remains available for confirmation and recovery

### Requirement: Lineage responses MUST belong to the issuing section activation

Resolve and restore completions MUST update the local version, draft, and saved
baseline only while their issuing command owns the current section activation.
Changing sections or unmounting MUST invalidate that ownership. Returning to
the same section MUST NOT reactivate an old command. A refreshed read within
the same activation MUST retain valid command ownership and existing version
checks. Server command identity and explicit retry semantics MUST remain unchanged.

#### Scenario: A lineage response arrives after changing sections

- **GIVEN** resolve or restore starts on section A
- **WHEN** section B becomes active before the response arrives
- **THEN** the response changes neither the local version nor the adopted section

#### Scenario: The form returns before its old lineage response arrives

- **GIVEN** resolve or restore starts on A and navigation activates B and then A
- **WHEN** the original command completes
- **THEN** it does not update the version, draft, or saved baseline of the new A activation

#### Scenario: A lineage owner unmounts before completion

- **GIVEN** resolve or restore is pending when its form owner unmounts
- **WHEN** the response arrives
- **THEN** it does not invoke local version acceptance or server-section adoption

#### Scenario: The current activation receives a refreshed read

- **GIVEN** resolve or restore is pending and a read refreshes the same active section
- **WHEN** the response arrives without leaving that activation
- **THEN** existing version checks permit adoption of the valid response
