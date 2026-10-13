## MODIFIED Requirements

### Requirement: The assistant exposes explicit product outcomes

The shared assistant output MUST be a discriminated union covering `ok`, `clarification_required`, `no_results`, `semantic_index_pending`, `result_set_too_large`, `invalid_plan`, and `ai_not_configured`. Transient supported-provider failures MUST use the separately specified `provider_unavailable` outcome, and generations cut off by the output limit MUST use `provider_response_incomplete`. Other provider, database, and invariant failures MUST remain technical errors mapped by the existing tRPC error boundary and MUST NOT masquerade as `no_results`. With a live lease, an expired assistant request deadline MUST produce `provider_unavailable` rather than accepting a late planner repair result through the Lead report-assistant tRPC procedure.

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

#### Scenario: Planner repair returns malformed data after the request deadline

- **WHEN** the request deadline expires while planner repair is pending, the lease remains live, and the repair later resolves malformed data
- **THEN** the procedure returns `provider_unavailable` rather than `invalid_plan`
- **AND** no further retrieval, answer or repair work starts, and the lease is released idempotently
