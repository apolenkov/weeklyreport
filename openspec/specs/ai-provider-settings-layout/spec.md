# ai-provider-settings-layout Specification

## Purpose

Define the compact, accessible layout of the administrator Settings → AI → Provider surface and its horizontal Settings tab strip.

## Requirements

### Requirement: AI Provider configuration uses a compact responsive layout

The `Settings → AI → Provider` surface rendered by `AiProviderCardContent` MUST
preserve the existing Provider disclosure, live configuration fields, lifecycle
actions, capability feedback, and revision information while presenting them
with one restrained Provider boundary, compact spacing, and a clear hierarchy.
At a large viewport, the Generation and Embeddings regions MUST be presented
as peer sections; at a narrow viewport, they MUST stack without page-level
horizontal overflow. The separate embedding connection fields MUST remain
conditional on the selected embedding mode.

#### Scenario: Admin scans the expanded Provider at desktop width

- **WHEN** an administrator opens `/admin?tab=settings`, selects `AI`, selects
  `Provider`, and expands the Provider surface at a desktop viewport
- **THEN** the Provider summary, Generation, Embeddings, actions, capability
  feedback, and revision information are visually distinct without duplicate
  heavy card chrome
- **AND** all existing live fields remain available, including generation
  profile/endpoint/models/credential/reasoning and embedding mode/model
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
- **THEN** the revision metadata, masked credentials, answer protocol,
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
