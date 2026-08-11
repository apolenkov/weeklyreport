## MODIFIED Requirements

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
