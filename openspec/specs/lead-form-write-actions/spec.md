# lead-form-write-actions Specification

## Purpose

Route lead-form writes through one tested action boundary while preserving optimistic locking, conflict handling, and user-visible side effects.

## Requirements

### Requirement: Lead form write actions are isolated behind a tested hook

The lead report form at `/lead/report/[reportId]` MUST keep submit, revoke,
reopen-request, and fill-from command orchestration behind a feature-local hook.
The hook MUST use the existing tRPC procedures and MUST NOT introduce new API
procedures, schemas, product UI strings, or write endpoints.

#### Scenario: LeadForm delegates write commands to the hook

- **WHEN** the lead report form renders
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

### Requirement: Write action side effects preserve current invariants

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

### Requirement: Revoke completion effects belong to the initiating form activation

The lead report form's revoke action MUST associate each started request with the exact committed form activation that initiated it. The transport and its cache invalidation MUST be allowed to finish after navigation or unmount. After the request settles, the React revoke action MUST invoke the unlock callback or show a success/error announcement only while that same activation remains current. It MUST NOT use report-section identity alone to authorize completion effects.

#### Scenario: Current revoke succeeds

- **GIVEN** a revoke request was started from the current form activation
- **WHEN** it succeeds while that activation remains current
- **THEN** the form invokes its unlock callback once
- **AND** it announces that the section was unlocked

#### Scenario: Current revoke fails

- **GIVEN** a revoke request was started from the current form activation
- **WHEN** it fails while that activation remains current
- **THEN** the form announces the error
- **AND** it does not invoke the unlock callback

#### Scenario: Revoke settles after another activation is current

- **GIVEN** activation A1 started a revoke request
- **WHEN** another activation is current or the form is unmounted before the request settles
- **THEN** the transport and cache invalidation may finish
- **AND** A1's completion invokes no unlock callback and shows no success or error announcement

#### Scenario: Returning to the same section creates a distinct owner

- **GIVEN** activation A1 started a revoke request
- **WHEN** navigation changes A1→B→A2 before that request settles
- **THEN** A2 is a distinct committed activation even though its generation string matches A1
- **AND** A1's completion invokes no callback and shows no announcement in A2
