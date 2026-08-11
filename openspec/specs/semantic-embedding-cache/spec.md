# semantic-embedding-cache Specification

## Purpose

Maintain a content-addressed semantic embedding cache across safely activated AI provider configurations.

## Requirements

### Requirement: A staged embedding scope is complete before activation

When an admin activation changes endpoint identity, embedding model, dimensions, or semantic-input version, the semantic indexing coordinator MUST populate the candidate scope while the old scope remains active. Before the global pointer changes, it MUST recompute the current canonical semantic-source hash set and prove that every current hash has a valid vector in the candidate scope with zero failed entries. The admin status surface MUST expose completed, total, failed, and elapsed preparation values and MUST NOT promise a fixed completion time.

#### Scenario: Candidate scope becomes complete

- **WHEN** every current canonical hash has a valid candidate-scope vector and no entry is failed
- **THEN** the coordinator may atomically activate the prepared configuration

#### Scenario: Report content changes during preparation

- **WHEN** a canonical source changes after the initial preparation enumeration
- **THEN** final reconciliation requires the new hash and excludes the stale hash from readiness
- **AND** the old configuration remains active until the new current hash is embedded

#### Scenario: Candidate scope cannot complete

- **WHEN** at least one current vector remains missing or failed after bounded retries
- **THEN** activation does not occur and the old scope continues serving retrieval

### Requirement: PostgreSQL stores a content-addressed embedding cache

The Prisma schema and PostgreSQL init migration MUST define pgvector support and a `SemanticEmbedding` model keyed uniquely by content hash, stable non-secret provider endpoint identity, model, semantic-input version, and dimensions. Each row MUST store a vector whose actual dimensions satisfy a database CHECK. The table MUST NOT store report text, authorization, user IDs, report IDs, candidate metadata, configuration credentials, or generated answers.

#### Scenario: The same semantic input is reused

- **WHEN** live, snapshot, or carry-over occurrences produce the same versioned content hash for the same endpoint identity, model, input version, and dimensions
- **THEN** they reuse one embedding row without merging their report occurrences

#### Scenario: Old and staged scopes coexist

- **WHEN** a candidate configuration changes endpoint identity, model, input version, or dimensions
- **THEN** its vectors coexist with old-scope rows and cannot overwrite them

#### Scenario: Embedding dimensions are invalid

- **WHEN** an adapter attempts to persist a vector whose length differs from the declared dimensions
- **THEN** PostgreSQL rejects the row

### Requirement: Ranking performs a bounded exact pgvector comparison

The semantic repository MUST parameterize the query vector and filter cache rows by provider, model, input version, dimensions, and the complete allowed content-hash set before cosine-distance ordering. The first version MUST use exact comparison and MUST NOT require an HNSW or IVFFlat index.

#### Scenario: Ranking receives a bounded candidate set

- **WHEN** every candidate embedding exists and the exact candidate count is within the configured maximum
- **THEN** the repository ranks only those hashes and applies the configured similarity threshold

#### Scenario: No candidate clears the threshold

- **WHEN** all complete-set similarities fall below the configured threshold
- **THEN** semantic retrieval returns `no_results` without widening exact filters

### Requirement: Hash freshness prevents stale embeddings from ranking

Semantic input MUST include a named input version, candidate kind, and canonical semantic text before SHA-256 hashing. Retrieval MUST consider an embedding current only when its full key matches the candidate's newly computed hash and the active endpoint identity, model, input version, and dimensions; timestamps and configuration revision IDs MUST NOT substitute for semantic scope equality.

#### Scenario: A draft record changes

- **WHEN** a Lead edits text after an earlier embedding was stored
- **THEN** the new candidate hash does not match the old vector
- **AND** the old vector cannot rank the updated record

#### Scenario: The embedding scope changes

- **WHEN** an admin activates a different endpoint identity, embedding model, input version, or dimensions
- **THEN** old cache rows coexist but are excluded from the new scope's ranking

#### Scenario: Only the credential or generation model changes

- **WHEN** an admin rotates the credential or changes planner or answer models without changing embedding scope
- **THEN** existing current embeddings remain reusable and no corpus rebuild is required

### Requirement: Semantic ranking requires complete embeddings

The application MUST compare the complete semantic-capable candidate hash set with available cache rows. If missing rows are within the configured read-through limit, it MUST embed and idempotently upsert all missing inputs before ranking. If missing rows exceed that limit, it MUST enqueue them and return `semantic_index_pending`; it MUST NOT rank a partial set or fall back silently to structured order.

#### Scenario: A few current-draft vectors are missing

- **WHEN** the missing count is within the synchronous read-through limit
- **THEN** all missing embeddings are created and the complete candidate set is ranked in the same request

#### Scenario: Many vectors are missing

- **WHEN** the missing count exceeds the read-through limit
- **THEN** jobs are enqueued for every missing candidate and no partial answer is generated

### Requirement: Background indexing reloads the canonical source

Each embedding job MUST contain a configuration revision ID, complete non-secret embedding scope, source locator, and expected content hash, not report text or credentials. The processor MUST extend `RawBullMqProcessor`, resolve the exact referenced revision rather than the current active revision, reload the live or published-snapshot source, rebuild canonical semantic text, compare its hash and scope, and idempotently upsert only an unchanged existing record. Queue names and retry options MUST each have one production source.

#### Scenario: Activation occurs while an old job is queued

- **WHEN** the global active pointer changes before a queued job runs
- **THEN** the worker uses the job's exact revision and scope rather than the new active configuration
- **AND** it cannot write a vector under a mismatched scope

#### Scenario: A queued live record changes before processing

- **WHEN** the reloaded record's hash differs from the expected hash
- **THEN** the worker completes the stale job without persisting its embedding

#### Scenario: A queued record is deleted

- **WHEN** the source locator no longer resolves
- **THEN** the worker safely completes without creating a cache row

### Requirement: AI indexing is independent of report writes

Report autosave, submit, reopen, publication, and other canonical write transactions MUST NOT wait for or depend on configured-provider embedding generation, activation preparation, Redis enqueue success, or pgvector ranking. Missing cache entries MUST be recoverable through preparation, read-through, and retrieval-triggered jobs.

#### Scenario: AI provider or Redis is unavailable during report save

- **WHEN** a Lead saves or submits a report while assistant infrastructure is unavailable or a new scope is preparing
- **THEN** the existing report write completes according to its current behavior
- **AND** no assistant failure changes the period dual-state or report-section transaction

### Requirement: Assistant infrastructure configuration is explicit and fail-fast

Every environment MUST explicitly supply the encryption master key, allowed provider origins, semantic input version, similarity threshold, candidate/read-through/exhaustive/context limits, planner/answer output limits, embedding batch/token budgets, and provider timeouts required by the assistant infrastructure. Product-selected provider, endpoint, credential, model identifiers, and dimensions MUST come from the active database configuration and MUST have no code or schema defaults. PostgreSQL environments MUST provide pgvector before the extension migration executes. The API MAY boot with no active product configuration but MUST expose AI as `not_configured`; it MUST fail boot when required deployment configuration is absent or malformed.

#### Scenario: Required deployment configuration is absent

- **WHEN** the API boots without the encryption key, allowed origins, operational limits, or pgvector support
- **THEN** validated configuration fails boot with a specific missing-value error

#### Scenario: Product configuration is absent

- **WHEN** deployment configuration is complete but no active AI revision exists
- **THEN** the API boots and non-AI report operations remain available
- **AND** AI availability is `not_configured`

#### Scenario: Application has an active tested configuration

- **WHEN** deployment requirements and one tested active provider revision are present
- **THEN** the API exposes the Lead assistant without changing existing report operations

#### Scenario: Existing target already applied the edited init migration

- **WHEN** a non-disposable migration ledger already records an init migration that lacks the revised cache key and configuration models
- **THEN** rollout stops before application deployment
- **AND** the schema is delivered through a reviewed additive forward migration without resetting that database or rewriting applied history

#### Scenario: Production privacy or region approval is absent

- **WHEN** training posture, retention/ZDR decision, endpoint region, or network destination has not been approved for the candidate provider
- **THEN** production activation remains blocked before any report content is sent
