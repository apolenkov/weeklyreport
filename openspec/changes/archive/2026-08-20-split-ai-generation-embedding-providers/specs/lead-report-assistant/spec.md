## MODIFIED Requirements

### Requirement: Report Assistant uses one provider-plus-prompt snapshot per request

At the start of each authorized request, `AiRuntimeResolver` MUST resolve the enabled active composite provider revision and active compatible `lead-report-assistant` prompt-bundle revision under one consistent database snapshot. The snapshot MUST contain the feature key, composite revision identity, generation compatibility identity, effective embedding scope identity, prompt revision identity, core-contract version, and composed effective prompts. Planner, planner-repair, grounded-answer, and citation-repair MUST use the generation transport with its tested reasoning and answer protocol. Query embedding and retrieval MUST use the effective embedding transport, which aliases generation only in `reuse_generation` mode. Every call in the request MUST retain the same immutable composite snapshot despite concurrent activation, and runtime MUST NOT fall back between transports.

#### Scenario: Separate connections serve one request

- **WHEN** a Lead request resolves a composite with Groq generation and Jina embeddings
- **THEN** planner and answer calls use only the Groq connection and embedding calls use only the Jina connection
- **AND** both belong to the same active revision snapshot

#### Scenario: Embeddings reuse generation

- **WHEN** the active revision uses `reuse_generation`
- **THEN** runtime aliases the generation connection for embeddings while using the configured embedding model
- **AND** it does not resolve a second credential

#### Scenario: Activation occurs during a request

- **WHEN** an administrator activates another composite or prompt bundle after snapshot acquisition
- **THEN** generation, query embedding, retrieval, and repair attempts retain the prior snapshot
- **AND** the next request may use the new active configuration

#### Scenario: One exact snapshot cannot be resolved

- **WHEN** no enabled composite and generation-compatible prompt pair exists at request start
- **THEN** the procedure returns `{ "kind": "ai_not_configured" }` before retrieval or provider work
- **AND** it does not fall back to another revision, connection, or compiled prompt

#### Scenario: One provider fails at runtime

- **WHEN** the selected generation or embedding connection fails after resolution
- **THEN** the procedure returns the existing bounded failure or indexing outcome
- **AND** it does not retry the operation through the other connection
