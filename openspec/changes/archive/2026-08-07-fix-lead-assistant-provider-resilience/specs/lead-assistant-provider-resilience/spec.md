## ADDED Requirements

### Requirement: Grounded answer payloads obey the configured context budget

The `leadForm.assistant` request path MUST project authorized `SearchCandidate` values into a compact answer-evidence contract and MUST estimate the configured context budget from the serialized grounding shape sent to the answer adapter. The evidence payload MUST NOT contain redundant retrieval identities, section identities, author identities, subject identities, linked-product identities, or complete candidate objects. Complete deterministic aggregates MUST be computed before evidence limiting.

#### Scenario: Candidate has large internal metadata

- **WHEN** a matching candidate contains short report text and metadata whose complete serialized form would exceed the context budget
- **THEN** the answer prompt contains only the compact evidence projection
- **AND** the estimated serialized grounding stays within the configured context budget

#### Scenario: Count answer uses limited evidence

- **WHEN** a count or comparison matches more candidates than fit in evidence
- **THEN** the answer adapter receives complete deterministic aggregates
- **AND** it receives only the evidence and supporting status facts that fit the context budget
- **AND** the result metadata identifies truncation

### Requirement: Compact grounding preserves answer-relevant facts

The compact evidence contract MUST preserve the candidate kind, human-readable record content, stage labels and kind-specific status or workflow fields required for a grounded answer. The server MUST continue to create and validate citations from server-owned source metadata.

#### Scenario: Every supported candidate kind is grounded

- **WHEN** Item, Risk, Decision, product status, stage status, or activity status evidence is selected
- **THEN** its compact discriminated record contains the answer-relevant fields for that kind
- **AND** its source ID resolves to the existing report citation metadata

### Requirement: Transient provider failures return a retryable assistant outcome

The Mistral adapters MUST preserve a safe operation name, optional HTTP status, and retryability classification when an SDK request fails. After the SDK's bounded retry behavior is exhausted, `leadForm.assistant` MUST return `provider_unavailable` for HTTP 429, HTTP 5xx, timeout, and transport failures. It MUST keep non-retryable provider failures and protocol violations as technical errors and MUST NOT manufacture an answer or `no_results` outcome.

#### Scenario: Provider exhausts a transient failure

- **WHEN** planner, answer, or citation-repair execution exhausts an HTTP 429, HTTP 5xx, timeout, or transport failure
- **THEN** `leadForm.assistant` returns `{ "kind": "provider_unavailable" }`
- **AND** retrieval data, prompts, provider response bodies, and secrets are absent from the client response

#### Scenario: Provider rejects a non-retryable request

- **WHEN** Mistral returns a non-retryable HTTP 4xx response
- **THEN** the request remains a mapped technical error
- **AND** the response is not represented as a temporary outage

### Requirement: Lead chat describes temporary provider failure accurately

The Lead report chat MUST render `provider_unavailable` using the existing assistant outcome presentation and retry control. The copy MUST identify a temporary AI-service problem and MUST NOT instruct the Lead to troubleshoot their own connection.

#### Scenario: Lead receives provider unavailable

- **WHEN** the assistant procedure returns `provider_unavailable`
- **THEN** the Sheet explains that the AI service is temporarily unavailable
- **AND** the Lead can retry the same active exchange
