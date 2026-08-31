# lead-assistant-provider-resilience Specification

## Purpose

Define bounded provider failure handling and deterministic recovery outcomes for the Lead Report Assistant without automatic provider failover.

## Requirements

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

Every supported provider profile and the OpenAI-compatible transport MUST preserve a safe operation name, optional HTTP status, and retryability classification when a planner, answer, citation-repair, or embedding request fails. After bounded retry behavior is exhausted, `leadForm.assistant` MUST return `provider_unavailable` for HTTP 429, HTTP 5xx, timeout, and transport failures. It MUST keep non-retryable provider failures and protocol violations as technical errors, MUST NOT manufacture an answer or `no_results`, and MUST NOT automatically send the request to another configured or built-in provider.

#### Scenario: Provider exhausts a transient failure

- **WHEN** planner, answer, citation-repair, or request-path embedding execution exhausts an HTTP 429, HTTP 5xx, timeout, or transport failure
- **THEN** `leadForm.assistant` returns `{ "kind": "provider_unavailable" }`
- **AND** retrieval data, prompts, provider response bodies, endpoint details, and secrets are absent from the client response

#### Scenario: Provider rejects a non-retryable request

- **WHEN** the active provider returns a non-retryable HTTP 4xx response
- **THEN** the request remains a mapped technical error
- **AND** the response is not represented as a temporary outage

#### Scenario: Active provider is unavailable while another revision exists

- **WHEN** the active provider fails and a prior or draft provider revision is stored
- **THEN** the request is not resent through that other revision
- **AND** only an explicit admin activation can change the global provider

### Requirement: OpenAI-compatible provider responses are bounded before parsing

The OpenAI-compatible transport MUST apply one product-defined maximum response
size in bytes to both successful and error responses before JSON parsing. The
bound MUST cover responses with a declared `Content-Length` and responses read
as chunked bodies. When the bound is exceeded, the transport MUST cancel the
response body, emit only a safe technical classification, MUST NOT include or
log the provider response body, and MUST mark the failure non-retryable
regardless of HTTP status.

#### Scenario: Declared response length exceeds the bound

- **WHEN** a chat or embeddings response declares a `Content-Length` above the
  product-defined maximum
- **THEN** the transport rejects it before JSON parsing
- **AND** the response is classified as a safe non-retryable technical error
- **AND** the provider response body is not returned or logged

#### Scenario: Chunked response crosses the bound

- **WHEN** a chat or embeddings response has no usable `Content-Length` and its
  streamed bytes exceed the product-defined maximum
- **THEN** the transport cancels the body and rejects the response
- **AND** the failure remains non-retryable even for HTTP 5xx
- **AND** the provider response body is not returned or logged

#### Scenario: Response is exactly at the bound

- **WHEN** a successful chat or embeddings response body is exactly the
  product-defined maximum in bytes and contains valid JSON
- **THEN** the transport accepts and parses the response normally

### Requirement: Lead chat describes temporary provider failure accurately

The Lead report chat MUST render `provider_unavailable` using the existing assistant outcome presentation and retry control. The copy MUST identify a temporary AI-service problem and MUST NOT instruct the Lead to troubleshoot their own connection.

#### Scenario: Lead receives provider unavailable

- **WHEN** the assistant procedure returns `provider_unavailable`
- **THEN** the Sheet explains that the AI service is temporarily unavailable
- **AND** the Lead can retry the same active exchange
