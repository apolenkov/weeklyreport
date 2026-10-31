## MODIFIED Requirements

### Requirement: The assistant exposes explicit product outcomes

The shared assistant output MUST be a discriminated union covering `ok`, `clarification_required`, `no_results`, `semantic_index_pending`, `result_set_too_large`, `invalid_plan`, and `ai_not_configured`. Transient supported-provider failures MUST use the separately specified `provider_unavailable` outcome, and generations cut off by the output limit MUST use `provider_response_incomplete`. Other provider, database, and invariant failures MUST remain technical errors mapped by the existing tRPC error boundary and MUST NOT masquerade as `no_results`. With a live lease, an expired assistant request deadline MUST produce `provider_unavailable` rather than accepting a late planner repair result through the Lead report-assistant tRPC procedure. A `clarification_required` outcome MUST include `total`, the number of distinct accessible candidates before the server option limit is applied, and `truncated`, which MUST be true exactly when `total` is greater than the number of returned options. The procedure MUST NOT paginate clarification options.

#### Scenario: Search needs user disambiguation

- **WHEN** an accessible reference resolves to more distinct entities than the server option limit
- **THEN** the procedure returns `clarification_required` with the first sorted accessible labeled options up to the limit and opaque resolution tokens
- **AND** `total` equals the full distinct candidate count and `truncated` is `true`
- **AND** the Lead UI states how many matches are shown out of the total and asks the Lead to refine the question

#### Scenario: Clarification candidates fit the option limit

- **WHEN** an accessible reference resolves to distinct entities that do not exceed the server option limit
- **THEN** the procedure returns `clarification_required` with every accessible labeled option and opaque resolution token
- **AND** `total` equals the option count and `truncated` is `false`
- **AND** the Lead UI shows no truncation message

#### Scenario: Semantic evidence is not complete yet

- **WHEN** the complete structured candidate set cannot be ranked until queued embeddings finish
- **THEN** the procedure returns `semantic_index_pending`
- **AND** it returns no partial semantic answer

#### Scenario: Direct call has no active configuration

- **WHEN** an authorized Lead invokes the assistant while global AI availability is `not_configured`
- **THEN** the procedure returns `{ "kind": "ai_not_configured" }` without retrieval or provider work
