## MODIFIED Requirements

### Requirement: Configured planning uses one forced typed search tool

The active language-model adapter MUST require the configured planner model to call exactly one `search_report_entries` tool whose JSON Schema is generated from the canonical compact shared `SearchPlan` schema. It MUST force that named tool, disable parallel tool calls, parse and validate its JSON arguments, and perform at most one bounded retry after rejected, malformed, or invalid arguments. It MUST NOT negotiate an alternate strict JSON-schema response protocol. The planner MUST NOT answer the question, execute retrieval, or receive report records, database IDs, the unrestricted organization catalog, SQL controls, vector limits, authorization decisions, or provider credentials.

#### Scenario: Configured planner produces a valid tool call

- **WHEN** the active planner returns exactly one named tool call whose arguments satisfy the shared schema
- **THEN** the server passes the validated plan to authorized entity resolution and retrieval

#### Scenario: First planner result is invalid

- **WHEN** the first tool request is rejected or its arguments are malformed or invalid
- **THEN** the adapter performs at most one retry using the same forced-tool protocol

#### Scenario: Planner remains invalid

- **WHEN** the bounded retry also fails
- **THEN** the assistant returns `invalid_plan` or the safe provider-unavailable outcome appropriate to the failure
- **AND** it sends no strict JSON-schema fallback request and performs no retrieval

### Requirement: Runtime uses one active provider and code-owned prompt snapshot

The report-assistant runtime MUST resolve the enabled active provider and compose the versioned code-owned `lead-report-assistant` prompts for one request. Runtime availability MUST NOT depend on an active prompt revision or an exact stored provider/prompt evaluation. Every planner, planner retry, answer, and citation-repair call in the request MUST use the same composed source version. Provider-only embedding worker resolution remains independent.

#### Scenario: Active provider serves without a prompt revision

- **WHEN** an enabled active provider exists and no stored prompt revision is active or evaluated
- **THEN** report-assistant runtime resolves code-owned prompts and serves the request

#### Scenario: No active provider exists

- **WHEN** no enabled active provider exists
- **THEN** the assistant returns `{ "kind": "ai_not_configured" }` before retrieval

### Requirement: Answers are grounded in server-prepared evidence

The answer adapter MUST send the original question and the bounded server-prepared evidence JSON to the configured answer model. It MUST request JSON Object Mode and accept only a minimal object containing Markdown answer text, cited source IDs, and an insufficient-evidence boolean. The adapter MUST NOT require a response-format JSON schema or a forced answer tool. The server MUST parse the object, allowlist source IDs, and MAY perform at most one bounded repair request using the same JSON Object Mode. It MUST return `no_results` without an answer-model request when retrieval produced no evidence.

#### Scenario: Model returns grounded answer JSON

- **WHEN** the answer model returns a valid JSON object whose Markdown and cited source IDs refer only to the evidence bundle
- **THEN** the server returns that Markdown and the resolved citations to the Chat consumer

#### Scenario: Model cites an unknown source

- **WHEN** the answer contains a source marker absent from the evidence bundle
- **THEN** the server rejects that marker and performs at most one bounded repair in JSON Object Mode
- **AND** it never exposes an unknown source link

#### Scenario: Retrieval returns no evidence

- **WHEN** authorized retrieval produces no evidence
- **THEN** the server returns the explicit no-results outcome without calling the answer model

### Requirement: Provider throttling remains inside the request budget

The report-assistant transport MUST honor a provider `Retry-After` value only
when it fits the bounded synchronous request budget. It MUST NOT clamp a longer
provider delay and repeatedly retry before the provider's stated reset time.
When the delay exceeds that budget, the server MUST return a safe rate-limited
outcome promptly so the web client does not misclassify provider throttling as a
broken connection.

#### Scenario: Short provider throttle clears within the request budget

- **WHEN** the provider returns HTTP 429 with a `Retry-After` delay inside the bounded retry budget
- **THEN** the transport waits for that delay and retries the request

#### Scenario: Provider throttle exceeds the request budget

- **WHEN** the provider returns HTTP 429 with a `Retry-After` delay longer than the bounded retry budget
- **THEN** the transport does not retry that request
- **AND** the assistant returns `provider_unavailable` with safe rate-limit metadata before the web request times out
