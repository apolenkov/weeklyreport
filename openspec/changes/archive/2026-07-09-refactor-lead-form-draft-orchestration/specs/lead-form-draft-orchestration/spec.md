## ADDED Requirements

### Requirement: Lead form draft orchestration is isolated behind a tested hook

The lead report form at `/lead/report/[reportId]` MUST keep its server-section
draft mirror, stable draft payload, autosave baseline, stale-version conflict
handler, and optimistic-lock version owner behind a feature-local hook. The
hook MUST use the existing `sectionToDraftPayload` and `useLeadFormAutosave`
contracts, and it MUST NOT introduce new tRPC procedures, schemas, product UI
strings, or write endpoints.

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
the existing reload/error toast instead of silently discarding or marking local
edits saved.

#### Scenario: Submit conflict reloads the section

- **WHEN** the submit mutation reports a stale-version conflict
- **THEN** `leadForm.byPeriod` is refetched
- **AND** the lead sees the reload message already used by the form today

#### Scenario: Autosave conflict suppresses the generic autosave toast

- **WHEN** autosave reports a stale-version conflict
- **THEN** the conflict handler handles the refetch/message path
- **AND** the autosave hook MUST NOT also show the generic autosave failure toast
