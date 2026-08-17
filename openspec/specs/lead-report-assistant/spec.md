# lead-report-assistant Specification

## Purpose

TBD - created by syncing add-native-lead-report-assistant.

## Requirements

### Requirement: The Lead report surface exposes a native Chat entry point

The Lead report context toolbar MUST render **Chat** immediately beside the existing **Agent review** placeholder. When global AI availability is `available`, Chat MUST be active and open the existing assistant surface. When availability is `not_configured`, unresolved, or cannot be read, Chat MUST remain visible but disabled and MUST explain in English that AI is not configured by an administrator. The control and chat surface MUST reuse the repository's existing report-toolbar, dialog/sheet/layout, typography, spacing, color, focus, busy, empty, and error patterns. Head, admin, viewer, print, and unrelated report surfaces MUST NOT gain an active assistant control in this change.

#### Scenario: Lead opens configured Chat from the report toolbar

- **WHEN** a Lead activates Chat while global AI availability is `available`
- **THEN** the report assistant surface opens without navigating to an unrelated application or losing the current report context
- **AND** the toolbar controls retain their established height and alignment

#### Scenario: Lead reaches Chat while AI is unconfigured

- **WHEN** global AI availability is `not_configured`
- **THEN** Chat remains visible but disabled with explanatory copy
- **AND** the web client sends no assistant request

#### Scenario: Availability has not been confirmed

- **WHEN** the authenticated availability query is loading or returns an error
- **THEN** Chat remains visible but disabled and the web client sends no assistant request

#### Scenario: A non-Lead reaches the assistant procedure

- **WHEN** a head, admin, viewer, or unauthenticated caller invokes the report-assistant tRPC procedure
- **THEN** the canonical role middleware rejects the request before assistant retrieval runs

### Requirement: The assistant accepts one bounded question through a shared contract

The Lead assistant tRPC procedure MUST validate a shared Zod input containing one safe-text question and zero or more server-issued resolution tokens. The initial capability MUST remain single-turn and MUST NOT persist conversation history, generated answers, prompts, or report evidence on the server or in durable browser storage. The web client MUST retain exactly one active exchange in authenticated-layout memory—including draft input, submitted question, resolution tokens, request state, and latest outcome—when the Sheet closes and across client-side navigation within the authenticated application. A new submission MUST replace that active exchange rather than append a turn. A full document reload, logout, or authenticated-user identity change MUST clear it.

#### Scenario: Lead submits a valid question

- **WHEN** the Lead submits a question within the shared length and visible-character bounds
- **THEN** the procedure processes that question as one independent assistant request

#### Scenario: Lead closes and reopens Chat

- **WHEN** the Lead closes the Sheet after entering a draft, submitting a question, receiving an outcome, or while a request is pending and then reopens it without a full document reload
- **THEN** the same single active exchange and request state remain visible
- **AND** no conversation turn is appended

#### Scenario: Lead navigates within the authenticated application

- **WHEN** the Lead follows an internal page or source link and later returns to a surface with the Chat control
- **THEN** the same single active exchange remains available
- **AND** no question, token, or answer was written to durable browser or server storage

#### Scenario: Client session ends

- **WHEN** the Lead logs out, the authenticated user identity changes, or the document is fully reloaded
- **THEN** the in-memory active exchange is cleared

#### Scenario: Input contains unknown or malformed fields

- **WHEN** the caller submits an unknown field, invisible-only question, null byte, invalid token shape, or over-limit input
- **THEN** shared strict Zod validation rejects the request before any configured provider call

### Requirement: Configured planning uses one forced typed search tool

The active language-model adapter MUST require the configured planner model to call exactly one `search_report_entries` tool whose JSON Schema is generated from the canonical shared `SearchPlan` Zod schema. It MUST implement the versioned planner and planner-repair contracts in `docs/llm-report/lead-report-assistant-prompt-contract.md`, force that tool, and disable parallel tool calls. The planner MUST NOT answer before tool execution and MUST NOT receive report records, database IDs, the unrestricted organization catalog, SQL controls, vector limits, authorization decisions, or provider credentials.

#### Scenario: Configured planner produces a valid tool call

- **WHEN** the active planner returns exactly one tool call that satisfies the shared schema and cross-field refinements
- **THEN** the server passes the validated plan to entity resolution

#### Scenario: Configured planner produces an invalid tool call twice

- **WHEN** the first plan is invalid and remains invalid after one bounded repair request containing field-level validation issues
- **THEN** the assistant returns `invalid_plan`
- **AND** the server does not silently default, drop, or rewrite invalid fields

### Requirement: The assistant exposes explicit product outcomes

The shared assistant output MUST be a discriminated union covering `ok`, `clarification_required`, `no_results`, `semantic_index_pending`, `result_set_too_large`, `invalid_plan`, and `ai_not_configured`. Transient supported-provider failures MUST use the separately specified `provider_unavailable` outcome. Other provider, database, and invariant failures MUST remain technical errors mapped by the existing tRPC error boundary and MUST NOT masquerade as `no_results`.

#### Scenario: Search needs user disambiguation

- **WHEN** an accessible reference resolves to multiple distinct entities
- **THEN** the procedure returns `clarification_required` with only accessible labeled options and opaque resolution tokens

#### Scenario: Semantic evidence is not complete yet

- **WHEN** the complete structured candidate set cannot be ranked until queued embeddings finish
- **THEN** the procedure returns `semantic_index_pending`
- **AND** it returns no partial semantic answer

#### Scenario: Direct call has no active configuration

- **WHEN** an authorized Lead invokes the assistant while global AI availability is `not_configured`
- **THEN** the procedure returns `{ "kind": "ai_not_configured" }` without retrieval or provider work

### Requirement: Runtime uses one exact provider and prompt snapshot

The report-assistant runtime MUST resolve the enabled active provider and the
active compatible `lead-report-assistant` prompt bundle under one repeatable
database snapshot. The request snapshot MUST include the provider revision,
feature key, prompt revision, contract version, and composed planner/repair,
answer/repair prompts. A missing, corrupt, stale, or unevaluated prompt bundle
MUST return `ai_not_configured` before retrieval. Runtime resolution MUST NOT
fall back to compiled prompt constants, while exact provider-only embedding
worker resolution remains independent of prompt activation.

#### Scenario: Prompt activation races with an in-flight request

- **WHEN** an administrator activates a new prompt bundle after a request has
  resolved its runtime snapshot
- **THEN** every planner, repair, answer, and citation-repair call in that
  request uses the original composed prompt set

#### Scenario: The active prompt pair is unavailable

- **WHEN** the global provider is active but the feature prompt control or exact
  provider/prompt evaluation is absent or invalid
- **THEN** the procedure returns `{ "kind": "ai_not_configured" }` before
  retrieval or provider work

### Requirement: Answers are grounded in server-prepared evidence

The answer adapter MUST receive only the original question, deterministic server aggregates, and an authorization-filtered `GroundingBundle`. It MUST implement the versioned grounded-answer and citation-repair contracts in `docs/llm-report/lead-report-assistant-prompt-contract.md`, keep trusted instructions separate from serialized untrusted evidence, and use a schema-constrained structured response. It MUST return structured Markdown, cited local source IDs, and an insufficient-evidence flag. The server MUST verify every cited ID, allow one bounded citation repair, and MUST NOT publish an answer containing unknown citations.

#### Scenario: Answer cites valid report evidence

- **WHEN** the answer model cites source IDs present in the GroundingBundle
- **THEN** the `ok` result includes the answer and only the corresponding report/period/author/subject citation metadata

#### Scenario: Answer repeats an unknown citation after repair

- **WHEN** the generated answer contains an unknown source ID and one repair attempt still contains an unknown ID
- **THEN** the request fails as a controlled assistant-generation error
- **AND** the server does not silently remove the invented citation

### Requirement: Report content remains untrusted AI input

The answer prompt MUST label Item, Risk, Decision, and Activity note content as untrusted data and MUST instruct the model not to execute instructions found inside it. Application logs and metric labels MUST NOT contain the question text, report content, prompts, embeddings, generated answers, user IDs, report IDs, or entity names.

#### Scenario: A report record contains prompt-injection text

- **WHEN** an authorized report record instructs the model to ignore policy or reveal system data
- **THEN** the record remains quoted evidence only
- **AND** no additional tool, secret, inaccessible record, or system prompt is exposed
