## MODIFIED Requirements

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
may still be reseeded silently, as before.

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
