# ai-provider-admin-layout Specification

## Purpose

Define the compact, accessible layout of the top-level Admin AI surface and its
Provider configuration, while preserving the independent responsive contract of
the Settings tab strip.

## Requirements

### Requirement: AI Provider configuration uses a compact responsive layout

The Provider surface MUST present Generation and Embeddings as distinct
peer-level configuration cards in the primary flow. Existing fields and
conditional separate-embedding behavior MUST remain available. An active
revision MUST open in a read/summary mode until the administrator chooses
`Edit configuration`; an unconfigured, draft, or failed revision MUST open in
edit mode. The layout MUST preserve the Demo visual language and remain usable
without page-level horizontal overflow at supported narrow widths. Built-in
profiles MUST NOT expose their fixed endpoint as an editable field; the custom
OpenAI-compatible profile MUST retain its bounded endpoint field. Configured
credential inputs MUST communicate that the stored credential can be retained
without rendering the masked suffix in the primary flow.

#### Scenario: Admin scans the direct Provider form at desktop width

- **WHEN** an administrator opens `/admin?tab=ai`, selects `Provider`, and
  enters or continues configuration at a desktop viewport
- **THEN** the state summary and ordered lifecycle explain whether the provider
  is serving and what action comes next
- **AND** Generation and Embeddings use aligned peer regions with all existing
  provider, model, reasoning, credential, and embedding-mode controls
- **AND** the custom endpoint field appears only for the custom
  OpenAI-compatible profile
- **AND** separate embedding connection controls appear only in `separate`
  mode

#### Scenario: Administrator edits an active revision

- **WHEN** the administrator activates `Edit configuration` for an active
  revision
- **THEN** the existing editable fields become available as a draft workflow
- **AND** cancelling edit mode leaves the active revision and service
  availability unchanged

#### Scenario: Administrator chooses separate embeddings

- **WHEN** the administrator selects the existing separate embedding mode
- **THEN** the separate provider, endpoint, credential, and model controls
  appear in the Embeddings card
- **AND** those controls remain absent when embeddings reuse the generation
  connection

#### Scenario: Administrator views a disabled retained configuration

- **GIVEN** the retained revision has lifecycle `active` but global provider
  availability is `not_configured`
- **WHEN** the administrator views its summary or edits the configuration
- **THEN** the summary identifies AI as disabled and the configuration as retained
- **AND** it does not claim that AI is available or already active
- **AND** editing remains available without offering another disable operation
- **AND** the feature readiness count and selected feature availability refresh
  after provider changes without a page reload

#### Scenario: Provider layout remains usable on a narrow viewport

- **WHEN** the same Provider workflow is opened at a narrow viewport
- **THEN** its summary, lifecycle steps, Generation, and Embeddings regions
  stack in a readable order
- **AND** controls, validation messages, feedback, and lifecycle actions remain
  reachable without horizontal page scrolling

### Requirement: Provider diagnostics remain available as secondary detail

The existing Diagnostics disclosure MUST remain closed by default and retain
revision metadata, capability results, preparation details, masked credential
metadata, and eligible Restore/Discard actions. The primary summary and
lifecycle cards MUST expose the next action without requiring Diagnostics to be
opened, and opening Diagnostics MUST NOT change provider lifecycle state.

#### Scenario: Administrator opens diagnostics after scanning the workflow

- **WHEN** the administrator opens the native `Diagnostics` disclosure
- **THEN** the retained diagnostic values and eligible revision actions are
  available without changing the active pointer or configuration state

#### Scenario: Direct Provider keeps the first viewport focused

- **WHEN** an administrator views a Provider revision with capability results
  or retained revisions
- **THEN** the capability status strip and any current progress, feedback, or
  error message remain visible in the primary flow
- **AND** revision metadata and retained-revision content are not expanded by
  default

#### Scenario: Administrator opens Provider diagnostics

- **WHEN** the administrator activates the `Diagnostics` disclosure
- **THEN** the revision metadata, masked credentials, capability-lane results,
  embedding measurement, and any Restore or Discard action become available
- **AND** opening diagnostics does not change provider lifecycle state or the
  active configuration

### Requirement: Settings tablist scrolls horizontally but never vertically

The outer `TabsList` rendered by `SettingsTab` MUST constrain vertical overflow
and MAY scroll horizontally when its tab triggers do not fit. The fix MUST NOT
change the tab values, trigger order, client-side navigation, or keyboard
selection behavior.

#### Scenario: Settings tabs exceed the available width

- **WHEN** an administrator views `/admin?tab=settings` at a viewport where the
  Settings tab triggers do not fit in one row
- **THEN** the outer tablist exposes horizontal overflow as needed
- **AND** it does not expose a vertical scrollbar or vertically scroll its
  contents
- **AND** every tab trigger remains reachable by pointer and keyboard

#### Scenario: Settings tabs fit the viewport

- **WHEN** the Settings tab triggers fit within the available width
- **THEN** the outer tablist has no unnecessary scroll area and remains a
  single horizontal row

### Requirement: AI Provider administration presents an explicit lifecycle workflow

The Admin `AI → Provider` surface MUST present a summary of the current
availability/revision state before the configuration controls and MUST expose
the existing lifecycle as visible ordered steps: `Configure`, `Test
capabilities`, and `Activate`. The steps MUST derive eligibility from existing
API state; an unavailable step MUST remain visible, disabled, and accompanied
by an actionable reason. The surface MUST show loading, async test progress,
preparation progress, and operation errors in accessible regions without
inventing a new lifecycle state or changing server semantics.

#### Scenario: Administrator scans an active provider

- **WHEN** an administrator opens `/admin?tab=ai` with an active revision
- **THEN** the first card identifies that AI is active and presents
  `Edit configuration` as the primary configuration action
- **AND** the Configure, Test capabilities, and Activate steps remain visible
  with Activate unavailable unless a new tested draft is selected
- **AND** Disable remains available through the existing active-service action

#### Scenario: Administrator continues an unconfigured or draft setup

- **WHEN** no active revision exists or the selected revision is `draft` or
  `failed`
- **THEN** the editable configuration form is initially available
- **AND** the summary states what is missing or failed and the next action
  explains why later steps are disabled

#### Scenario: Administrator observes asynchronous work

- **WHEN** a provider test is queued/running or an activation is preparing
- **THEN** the UI identifies the operation state and disables duplicate or
  conflicting actions
- **AND** test lanes or preparation completed/total/failed/elapsed values are
  shown from the existing read model
- **AND** a recoverable error includes an actionable next step without exposing
  provider response bodies or credentials

### Requirement: AI readiness is a status strip, not part of the tabs

The AI settings page MUST present provider readiness and feature readiness
count in a polite status region outside the `Provider` / `Features` tablist.
Tab triggers MUST carry only their navigation label.

#### Scenario: Administrator reads readiness

- **WHEN** an administrator opens `/admin?tab=ai`
- **THEN** a status region named "AI readiness" shows the provider state and the
  "N/M ready" feature count
- **AND** neither tab's text contains a status

#### Scenario: Readiness changes after a provider change

- **WHEN** the provider is disabled
- **THEN** the status region updates to "Setup required" and "0/N ready"
  without a reload

### Requirement: Custom reasoning feedback follows input correction

The Provider form at `/admin?tab=ai` MUST clear its local missing-custom-reasoning error and invalid marker when the generation input is corrected to an admitted custom value or changes to a mode that does not require that value. Whitespace-only or otherwise invalid custom input and unrelated generation-model edits MUST NOT retire that error. Input correction MUST NOT submit a draft or change provider, credential or server validation policy.

#### Scenario: Administrator corrects missing custom reasoning

- **WHEN** a blank custom reasoning submission shows the local error and the administrator enters an admitted nonblank custom value
- **THEN** the stale error and invalid marker disappear
- **AND** no draft is submitted until the administrator explicitly submits

#### Scenario: The missing value remains unresolved

- **WHEN** the administrator enters only whitespace or changes an unrelated generation model after a missing-custom-value error
- **THEN** the custom value remains marked invalid with its error
- **AND** blank custom submission remains refused

#### Scenario: Administrator selects a mode without a custom value

- **WHEN** the administrator changes from custom reasoning to Provider default or Off after a missing-custom-value error
- **THEN** that no-longer-applicable local error is retired
- **AND** the existing explicit submit flow remains unchanged
