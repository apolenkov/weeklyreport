## MODIFIED Requirements

### Requirement: Integrations Sub-Tab Surfaces Only Roadmapped Integrations

The Integrations sub-tab MUST list only external integrations that are real or
roadmapped and MUST NOT render provider, prompt, evaluation, or other AI product
controls after the dedicated Settings → AI workspace is available. Every listed
integration that is not yet activated MUST use the shared Coming-Soon affordance.
The messaging-integration card MUST display the planned channel name **Element**;
the displayed name is decoupled from the not-yet-built transport, so the Element
card MUST NOT render any Telegram-derived live status. The Element card is heading

- description + Coming-Soon badge and asserts no messaging status.

#### Scenario: Dropped and relocated cards are absent

- **WHEN** an administrator opens the Integrations sub-tab
- **THEN** no Slack or CI card is rendered
- **AND** no AI provider, prompt, evaluation, or feature-management control is
  rendered there

#### Scenario: Element remains the roadmapped external integration

- **WHEN** an administrator opens the Integrations sub-tab
- **THEN** a card headed "Element" is rendered with a description and the shared
  Coming-Soon badge
- **AND** AI administration is available only from the dedicated AI sub-tab

#### Scenario: Element renders no Telegram-derived status

- **WHEN** the Telegram transport has active bindings and an administrator opens
  Integrations
- **THEN** the Element card does not show Telegram-derived configured or active
  values
- **AND** it asserts no live messaging status

## ADDED Requirements

### Requirement: Settings exposes a dedicated AI administration workspace

`SettingsTab` MUST expose an **AI** sub-tab alongside the existing Settings
navigation. The AI workspace MUST provide accessible local navigation for
**Overview**, **Provider**, and **Features** without a full document reload.
Overview MUST summarize global provider availability and readiness of registered AI
features. Provider MUST contain the live global provider lifecycle controls.
Features MUST list only code-registered features and initially expose Report
Assistant without rendering controls for unimplemented future features.

#### Scenario: Administrator opens the AI workspace

- **WHEN** an administrator selects Settings → AI
- **THEN** Overview, Provider, and Features navigation is available
- **AND** the page renders no duplicate provider controls under Integrations

#### Scenario: Report Assistant is the first registered feature

- **WHEN** an administrator opens AI → Features before additional AI features ship
- **THEN** Report Assistant is listed with its configuration readiness
- **AND** no arbitrary or unimplemented feature key is displayed as live

#### Scenario: AI workspace remains usable on narrow screens

- **WHEN** Settings → AI is rendered at a mobile viewport
- **THEN** the AI local navigation remains keyboard and touch accessible without
  clipping required actions
- **AND** selecting a destination preserves the mounted admin Settings experience

### Requirement: AI provider settings are compact until attention or intent requires expansion

The Settings → AI → Provider `AiProviderCard` MUST provide an accessible disclosure
control. In its collapsed state it MUST identify global availability and the active
provider/model summary without exposing credentials. The disclosure MUST expose
`aria-expanded` and an accessible label. It MUST initially expand when no usable
active configuration exists, the displayed revision is `draft`, `failed`, or
`preparing`, or the latest operation failed. Otherwise it MUST initially collapse.
After an administrator explicitly toggles it, query refreshes MUST NOT override that
choice during the mounted session.

#### Scenario: Stable provider is compact in its new location

- **WHEN** an administrator opens AI → Provider with an available active
  configuration and no operation error
- **THEN** the provider card is initially collapsed
- **AND** its visible summary identifies the provider/model without a credential

#### Scenario: Provider configuration requires attention

- **WHEN** no usable active configuration exists or the displayed revision is
  `draft`, `failed`, or `preparing`
- **THEN** the provider card is initially expanded
- **AND** the form, lifecycle feedback, and preparation progress remain accessible

#### Scenario: Explicit disclosure choice survives refetch

- **WHEN** an administrator toggles the provider card and its control query refetches
- **THEN** the selected disclosure state is preserved for the mounted session

### Requirement: Disposable AI provider attempts have a confirmed discard action

The expanded AI → Provider card MUST distinguish disposable `draft` and `failed`
attempts from retained `superseded` configurations. It MUST present **Discard** only
for disposable attempts, require confirmation that the configuration and credential
cannot be restored, and disable conflicting revision actions while discard is
pending. Success MUST refresh `admin.aiProvider.get`; failure MUST keep the revision
visible and show a safe error. `validated`, `preparing`, `active`, and `superseded`
revisions MUST NOT expose discard.

#### Scenario: Administrator discards a failed provider attempt

- **WHEN** an administrator confirms **Discard** for a failed attempt
- **THEN** the UI invokes `admin.aiProvider.discard` with that revision ID
- **AND** the attempt is absent after the control read refreshes

#### Scenario: Retained provider revision remains restorable

- **WHEN** a superseded revision is displayed
- **THEN** its restore action remains available
- **AND** no discard action is rendered

#### Scenario: Provider discard fails

- **WHEN** `admin.aiProvider.discard` fails
- **THEN** the attempted revision remains visible with a safe operation error

### Requirement: Provider form exposes one universal reasoning control

The expanded Settings → AI → Provider form MUST expose one optional **Reasoning**
control that applies to planner, planner-repair, answer, and citation-repair
generation. It MUST offer only **Provider default**, **Off**, and **Custom**. Selecting
**Custom** MUST reveal one text input for a trimmed, non-empty provider-specific
reasoning value of at most 64 characters. The form MUST NOT accept raw reasoning JSON
or arbitrary request parameters. It MUST NOT expose provider-routing controls or an
answer-protocol selector. Capability feedback MUST state safely when the selected
reasoning configuration is incompatible; answer-protocol selection remains an
automatic tested property of the revision.

#### Scenario: Administrator keeps provider reasoning defaults

- **WHEN** the administrator saves **Provider default**
- **THEN** the draft records the provider-default configuration
- **AND** capability testing verifies planner and answer behavior without sending a
  reasoning parameter

#### Scenario: Administrator disables reasoning

- **WHEN** the administrator saves **Off**
- **THEN** the draft retains that configuration for profile-specific capability
  testing
- **AND** activation remains unavailable until both generation contracts pass with
  it

#### Scenario: Administrator enters a custom reasoning value

- **WHEN** the administrator selects **Custom** and saves a non-empty text value
- **THEN** the draft retains that exact trimmed value for profile-specific capability
  testing
- **AND** the UI does not reinterpret it as a routing mode or arbitrary request JSON

#### Scenario: Custom reasoning value is missing

- **WHEN** the administrator selects **Custom** without a non-empty text value
- **THEN** save is rejected with an inline validation error

#### Scenario: Reasoning configuration is incompatible

- **WHEN** capability testing rejects the selected reasoning field or value
- **THEN** the form retains the failed revision and selected value
- **AND** it shows a safe actionable failure without provider response content

#### Scenario: Provider-specific routing remains outside the universal form

- **WHEN** an administrator configures any built-in or custom provider profile
- **THEN** no Balanced, Nitro, Exacto, price, throughput, or arbitrary routing
  control is rendered

#### Scenario: Answer protocol is detected automatically

- **WHEN** capability testing selects JSON Schema output or a forced answer tool
- **THEN** no extra configuration action is required from the administrator
- **AND** the tested protocol may be shown as read-only revision metadata

### Requirement: AI compatibility testing remains observable beyond one request

Starting provider capability testing or prompt evaluation MUST show a durable
queued/running state and MUST NOT keep the initiating browser request open for the
duration of provider calls. The AI workspace MUST poll the applicable read model,
resume that state after reload, disable duplicate starts for the same candidate,
and stop polling at a terminal result. It MUST distinguish proven incompatibility
from an inconclusive transient failure and show bounded failed feature/check labels.
It MUST NOT expose credentials, prompt bodies, provider response bodies, native JSON
parser errors, DOM exceptions, or proxy error text.

#### Scenario: Long provider test outlives the HTTP timeout window

- **WHEN** a provider suite takes longer than an ordinary request timeout
- **THEN** the initiating action has already returned with durable queued/running
  state
- **AND** the UI continues polling until the worker persists a terminal result

#### Scenario: Inconclusive result is actionable

- **WHEN** testing ends inconclusively because of throttling, timeout, transport, or
  provider/server failure
- **THEN** the UI states that compatibility was not determined and allows an
  explicit retry
- **AND** it does not label the selected model or prompt as incompatible

#### Scenario: Upstream response is not valid tRPC JSON

- **WHEN** a proxy or upstream component returns a non-JSON failure response
- **THEN** the UI displays one bounded safe operation error
- **AND** it does not display the parser or platform exception text

### Requirement: Report Assistant prompt administration edits complete prompts progressively

AI → Features → Report Assistant MUST show the active prompt-bundle version, its
provider compatibility, and the four planner/repair/answer/repair slots. The UI
MUST initially render those slots as a compact accessible list; opening a slot MUST
reveal an editor for its complete prompt text. The surface MUST provide an
active-versus-candidate diff, immutable version history, safe evaluation results,
and lifecycle-appropriate Save draft, Run evaluation, Activate, Restore, and
Discard actions.

#### Scenario: Administrator edits prompt behavior

- **WHEN** an administrator creates a draft from the active Report Assistant bundle
- **THEN** the complete text of each catalog-owned prompt is editable
- **AND** feature key, slot keys, hashes, lifecycle metadata, tools, schemas, and
  runtime controls cannot be changed through the form

#### Scenario: Administrator initially sees a compact prompt list

- **WHEN** an administrator opens Report Assistant prompt settings
- **THEN** the four prompt names are visible without four long prompt bodies
- **AND** each prompt can be expanded with keyboard or pointer input to reveal its
  complete editor

#### Scenario: Administrator reviews a candidate before activation

- **WHEN** a prompt candidate differs from the active bundle
- **THEN** the UI shows the effective diff and evaluation status against the exact
  provider revision
- **AND** Activate remains unavailable until the candidate has a current passing
  evaluation

#### Scenario: Prompt operation fails

- **WHEN** draft, evaluation, activation, restore, or discard fails
- **THEN** the current editor/version selection remains visible
- **AND** the UI presents a safe recoverable error without prompt or provider body
  leakage
