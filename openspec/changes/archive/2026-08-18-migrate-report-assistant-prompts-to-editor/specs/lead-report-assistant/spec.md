## MODIFIED Requirements

### Requirement: Runtime uses one exact provider and prompt snapshot

The report-assistant runtime MUST resolve the enabled active provider and the
active current-serving `lead-report-assistant` prompt revision under one
repeatable database snapshot. The request snapshot MUST include the provider
revision, feature key, prompt revision, serving-contract identity, contract
version, and composed planner/repair and answer/repair prompts. A missing,
corrupt, stale, legacy, or incompatible prompt bundle MUST return
`ai_not_configured` before retrieval. Runtime resolution MUST NOT fall back to
compiled prompt constants or the removed integration. Exact provider-only
embedding worker resolution remains independent of prompt activation.

#### Scenario: Prompt activation races with an in-flight request

- **WHEN** an administrator activates a new current-serving prompt bundle
  after a request has resolved its runtime snapshot
- **THEN** every planner, repair, answer, and citation-repair call in that
  request uses the original composed prompt set

#### Scenario: The active prompt pair is unavailable

- **WHEN** the global provider is active but the feature prompt control,
  current serving identity, stored snapshot, or content hash is absent or
  invalid
- **THEN** the procedure returns `{ "kind": "ai_not_configured" }` before
  retrieval or provider work

#### Scenario: An active prompt has no evaluation record

- **WHEN** the active prompt is structurally valid and current-serving but has
  no prompt evaluation row
- **THEN** runtime resolution still returns the provider/prompt snapshot
- **AND** no evaluation or LLM request is made as part of resolution

#### Scenario: The active prompt revision is from the removed integration

- **WHEN** the active pointer references a revision without the current
  serving-contract identity
- **THEN** the runtime treats the configuration as unavailable
- **AND** it does not execute the planner, retrieval, answer, or
  citation-repair path

## ADDED Requirements

### Requirement: Prompt source changes preserve the working generation protocols

Switching prompt text from compiled constants to a current-serving editor
revision MUST NOT change the report-assistant generation protocols. The planner
MUST continue to use exactly one forced `search_report_entries` tool call with
the current compact `SearchPlan` contract and bounded repair. The answer MUST
continue to use the current JSON Object Mode envelope, server-prepared evidence,
source allowlisting, and bounded citation repair. Tool schemas,
authorization, retrieval limits, aggregates, and output validation MUST remain
server-owned and MUST NOT be editable through prompt lifecycle operations.

#### Scenario: A current editor revision serves a normal question

- **WHEN** the runtime resolves a valid provider and current-serving prompt
  revision
- **THEN** planner, retrieval, answer, and citation validation use the same
  current protocols as the working code-owned pipeline
- **AND** the request returns the same public assistant outcome contract

#### Scenario: An editor prompt attempts to replace server controls

- **WHEN** stored prompt text contains instructions to invent identifiers,
  bypass authorization, alter tool schemas, or change citation allowlisting
- **THEN** the server continues to enforce its code-owned schemas and controls
- **AND** the prompt text cannot grant additional data access or protocol
  capabilities
