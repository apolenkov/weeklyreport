# lead-form-write-actions Specification

## Purpose

TBD - created by archiving change refactor-lead-form-write-actions. Update Purpose after archive.

## Requirements

### Requirement: Lead form write actions are isolated behind a tested hook

The lead report form at `/lead/report/[reportId]` MUST keep submit, revoke,
reopen-request, and fill-from command orchestration behind a feature-local hook.
The hook MUST use the existing tRPC procedures and MUST NOT introduce new API
procedures, schemas, product UI strings, or write endpoints.

#### Scenario: LeadForm delegates write commands to the hook

- **WHEN** the lead report form renders after the extraction
- **THEN** `LeadForm` obtains submit, revoke, reopen-request, and fill-from
  command handlers from the write-actions hook
- **AND** record merge handlers remain outside that hook

### Requirement: Write actions preserve optimistic-lock and conflict behavior

The write-actions hook MUST consume the draft orchestration hook's current
version and conflict APIs. Submit and fill-from MUST read the current
optimistic-lock version synchronously at command time, and stale-version
conflicts MUST use the same refetch/reload-message path as autosave.

#### Scenario: Submit reads the current version and updates it on success

- **WHEN** a lead confirms submit after autosave or refetch has advanced the
  section version
- **THEN** the submit mutation sends the current `versionRef.current`
- **AND** submit success updates the version owner from the saved read model

#### Scenario: Fill-from conflict uses the reload path

- **WHEN** fill-from fails with a stale-version conflict
- **THEN** the hook invokes the shared conflict handler
- **AND** it does not show the generic fill-from failure toast

### Requirement: Write action side effects remain behavior-compatible

The write-actions hook MUST preserve the existing invalidation families, dialog
state transitions, inline reopen error handling, and toast strings for submit,
revoke, reopen-request, and fill-from.

#### Scenario: Reopen request success resets dialog state

- **WHEN** `leadForm.requestReopen` succeeds
- **THEN** the reopen dialog closes
- **AND** the inline reopen error is cleared
- **AND** lead-form data is invalidated so `canRequestReopen` can refresh

#### Scenario: Revoke success refreshes all current consumers

- **WHEN** `leadForm.revoke` succeeds
- **THEN** the hook invalidates lead-form, dashboard, and lead-history data
- **AND** the submitted state becomes false
