## ADDED Requirements

### Requirement: PostgreSQL stores a content-addressed embedding cache

The Prisma schema and PostgreSQL init migration MUST define pgvector support and a `SemanticEmbedding` model keyed uniquely by content hash, provider, model, and semantic-input version. Each row MUST store dimensions and a vector whose actual dimensions satisfy a database CHECK. The table MUST NOT store report text, authorization, user IDs, report IDs, candidate metadata, or generated answers.

#### Scenario: The same semantic input is reused

- **WHEN** live, snapshot, or carry-over occurrences produce the same versioned content hash for the configured provider and model
- **THEN** they reuse one embedding row without merging their report occurrences

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

Semantic input MUST include a named input version, candidate kind, and canonical semantic text before SHA-256 hashing. Retrieval MUST consider an embedding current only when its full key matches the candidate's newly computed hash and active model configuration; timestamps MUST NOT substitute for hash equality.

#### Scenario: A draft record changes

- **WHEN** a Lead edits text after an earlier embedding was stored
- **THEN** the new candidate hash does not match the old vector
- **AND** the old vector cannot rank the updated record

#### Scenario: The embedding model changes

- **WHEN** deployment selects a different model or dimensions
- **THEN** old cache rows coexist but are excluded from the new model's ranking

### Requirement: Semantic ranking requires complete embeddings

The application MUST compare the complete semantic-capable candidate hash set with available cache rows. If missing rows are within the configured read-through limit, it MUST embed and idempotently upsert all missing inputs before ranking. If missing rows exceed that limit, it MUST enqueue them and return `semantic_index_pending`; it MUST NOT rank a partial set or fall back silently to structured order.

#### Scenario: A few current-draft vectors are missing

- **WHEN** the missing count is within the synchronous read-through limit
- **THEN** all missing embeddings are created and the complete candidate set is ranked in the same request

#### Scenario: Many vectors are missing

- **WHEN** the missing count exceeds the read-through limit
- **THEN** jobs are enqueued for every missing candidate and no partial answer is generated

### Requirement: Background indexing reloads the canonical source

Each embedding job MUST contain a source locator and expected content hash, not report text. The processor MUST extend `RawBullMqProcessor`, reload the live or published-snapshot source, rebuild canonical semantic text, compare its hash, and idempotently upsert only an unchanged existing record. Queue names and retry options MUST each have one production source.

#### Scenario: A queued live record changes before processing

- **WHEN** the reloaded record's hash differs from the expected hash
- **THEN** the worker completes the stale job without persisting its embedding

#### Scenario: A queued record is deleted

- **WHEN** the source locator no longer resolves
- **THEN** the worker safely completes without creating a cache row

### Requirement: AI indexing is independent of report writes

Report autosave, submit, reopen, publication, and other canonical write transactions MUST NOT wait for or depend on Mistral embedding generation, Redis enqueue success, or pgvector ranking. Missing cache entries MUST be recoverable through read-through and retrieval-triggered jobs.

#### Scenario: Mistral or Redis is unavailable during report save

- **WHEN** a Lead saves or submits a report while assistant infrastructure is unavailable
- **THEN** the existing report write completes according to its current behavior
- **AND** no assistant failure changes the period dual-state or report-section transaction

### Requirement: Assistant infrastructure configuration is explicit and fail-fast

Every environment MUST explicitly supply the Mistral API secret/model identifiers, API server/region, embedding dimensions, semantic input version, similarity threshold, candidate/read-through/exhaustive/context limits, planner/answer output limits, embedding batch/token budgets, and provider timeouts required by the enabled assistant. Product configuration MUST have no code or schema defaults. PostgreSQL environments MUST run a PostgreSQL 15 image that provides pgvector before the extension migration executes. Production rollout MUST verify the paid-workspace training posture, retention/ZDR decision, approved data region, model availability, direct database migration path, and port-443 provider reachability before report content is sent.

#### Scenario: Required assistant configuration is absent

- **WHEN** the API boots after assistant rollout without a required configuration value
- **THEN** validated configuration fails boot with a specific missing-value error

#### Scenario: Application is deployed with complete configuration

- **WHEN** secrets, model identifiers, limits, and pgvector support are present
- **THEN** the API boots and exposes the Lead assistant without changing existing report operations

#### Scenario: Existing target already applied the edited init migration

- **WHEN** the production migration ledger already records the init migration that was edited for disposable environments
- **THEN** rollout stops before application deployment
- **AND** the pgvector extension and cache schema are delivered through a reviewed additive forward migration without resetting production or rewriting applied history

#### Scenario: Production privacy or region approval is absent

- **WHEN** the paid-workspace training posture, retention/ZDR decision, or endpoint data region has not been approved
- **THEN** the deployment runbook blocks production assistant activation before any report content is sent to Mistral
