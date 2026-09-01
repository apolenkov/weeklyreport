# ai-provider-admin-layout Specification

## Purpose

Define the compact, accessible layout of the top-level Admin AI surface and its
Provider configuration, while preserving the independent responsive contract of
the Settings tab strip.

## Requirements

### Requirement: AI Provider configuration uses a compact responsive layout

The top-level Admin `AI → Provider` surface rendered by
`AiProviderCardContent` MUST preserve the existing Provider disclosure, live
configuration fields, lifecycle actions, capability feedback, and revision
information while presenting them with one restrained Provider boundary,
compact copy, and a clear hierarchy. At a large viewport, the Generation and
Embeddings regions MUST be presented as equal-width peer sections whose
headings and first controls align; at a narrow
viewport, they MUST stack without page-level horizontal overflow. The separate
embedding connection fields MUST remain conditional on the selected embedding
mode. Built-in profiles MUST NOT render their fixed endpoint as an editable or
disabled field; a compact endpoint field MUST appear only for the custom
OpenAI-compatible profile. Provider and feature readiness MUST be displayed in
the corresponding tab triggers rather than in a separate summary card. An
unconfigured form MUST visibly prefill the repository's Mistral model preset
while remaining disabled until the administrator supplies a credential, tests
the draft successfully, and explicitly activates it. Save, Test, and Activate
MUST remain visible as one ordered action sequence; unavailable later steps
MUST be disabled instead of omitted.

The selected `Provider` tab is the only visible Provider title. Its disclosure
header MUST contain only the active-configuration summary, readiness state, and
disclosure affordance; it MUST NOT repeat an `AI provider` heading or explanatory
copy already supplied by the AI surface.

#### Scenario: Admin scans the expanded Provider at desktop width

- **WHEN** an administrator opens `/admin?tab=ai`, selects `Provider`, and
  expands the Provider surface at a desktop viewport
- **THEN** the Provider summary, Generation, Embeddings, actions, capability
  feedback, and revision information are visually distinct without duplicate
  heavy card chrome
- **AND** the disclosure header does not repeat the selected Provider title or
  its explanatory copy
- **AND** the two peer sections use concise descriptions and align their first
  controls on the same row
- **AND** all existing live fields remain available, including generation
  provider/models/credential/reasoning and embedding mode/model
- **AND** the custom endpoint field appears without changing the height of the
  desktop provider row or adding helper copy below it
- **AND** separate embedding profile/endpoint/credential fields are shown only
  when the embedding connection mode is `separate`

#### Scenario: Provider layout remains usable on a narrow viewport

- **WHEN** the same Provider surface is opened at a narrow viewport
- **THEN** Generation and Embeddings stack in a readable order
- **AND** controls, validation messages, feedback, and lifecycle actions remain
  reachable without horizontal page scrolling

### Requirement: Provider diagnostics remain available as secondary detail

The expanded `AiProviderCardContent` MUST keep capability status, preparation
progress, operation feedback, and errors in the primary flow. Revision metadata
and retained-revision actions MUST be grouped inside an accessible native
disclosure labelled `Diagnostics`, closed by default, and MUST preserve all
existing diagnostic values and lifecycle actions when opened.

#### Scenario: Expanded Provider keeps the first viewport focused

- **WHEN** an administrator expands a Provider revision with capability results
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
