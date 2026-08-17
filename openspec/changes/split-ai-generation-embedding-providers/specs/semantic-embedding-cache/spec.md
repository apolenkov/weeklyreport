## MODIFIED Requirements

### Requirement: A staged embedding scope is complete before activation

When `admin.aiProvider.activate` changes the effective embedding endpoint identity, model, dimensions, or semantic-input version, the semantic indexing coordinator MUST use only the candidate's effective embedding connection to populate the staged scope while the entire prior composite remains active. Before the global pointer changes, it MUST recompute the canonical semantic-source hash set and prove that every current hash has a valid vector in the candidate scope with zero failed entries. Generation identity changes and embedding credential rotation MUST NOT trigger preparation when effective embedding scope is unchanged. Status MUST expose completed, total, failed, and elapsed values without promising a completion time.

#### Scenario: Candidate scope becomes complete

- **WHEN** every current canonical hash has a valid candidate-scope vector and no entry is failed
- **THEN** the coordinator may atomically activate the complete composite revision

#### Scenario: Report content changes during preparation

- **WHEN** a canonical source changes after initial enumeration
- **THEN** final reconciliation requires the new hash and excludes the stale hash
- **AND** the previous composite remains active until the new current hash is embedded

#### Scenario: Candidate scope cannot complete

- **WHEN** at least one current vector remains missing or failed after bounded retries
- **THEN** activation does not occur and the old composite continues serving

#### Scenario: Only generation or embedding credential changes

- **WHEN** the effective embedding endpoint, model, dimensions, and input version are unchanged
- **THEN** no corpus preparation is scheduled

### Requirement: PostgreSQL stores a content-addressed embedding cache

The Prisma schema and PostgreSQL init migration MUST define pgvector support and a `SemanticEmbedding` model keyed uniquely by effective non-secret embedding endpoint identity, model, semantic-input version, dimensions, and content hash. Each row MUST store a vector whose actual dimensions satisfy a database CHECK. The cache key MUST NOT include generation connection identity, composite revision ID, or credential. The table MUST NOT store report text, authorization, user IDs, report IDs, candidate metadata, configuration credentials, or generated answers.

#### Scenario: The same semantic input is reused

- **WHEN** occurrences produce the same versioned content hash for the same effective embedding endpoint identity, model, input version, and dimensions
- **THEN** they reuse one embedding row regardless of generation provider or composite revision

#### Scenario: Old and staged scopes coexist

- **WHEN** a candidate changes effective embedding endpoint identity, model, input version, or dimensions
- **THEN** its vectors coexist with old-scope rows and cannot overwrite them

#### Scenario: Embedding dimensions are invalid

- **WHEN** an adapter persists a vector whose length differs from declared dimensions
- **THEN** PostgreSQL rejects the row

### Requirement: Hash freshness prevents stale embeddings from ranking

Semantic input MUST include a named input version, candidate kind, and canonical semantic text before SHA-256 hashing. Retrieval MUST consider an embedding current only when its full key matches the newly computed content hash and the active composite's effective embedding endpoint identity, model, input version, and dimensions; timestamps, generation identity, credential, and configuration revision IDs MUST NOT substitute for semantic scope equality.

#### Scenario: A draft record changes

- **WHEN** a Lead edits text after an earlier embedding was stored
- **THEN** the new candidate hash does not match the old vector and the old vector cannot rank the updated record

#### Scenario: The embedding scope changes

- **WHEN** an administrator activates a different effective embedding endpoint identity, model, input version, or dimensions
- **THEN** old cache rows coexist but are excluded from the new scope's ranking

#### Scenario: Generation changes

- **WHEN** generation profile, credential, planner model, answer model, reasoning, or answer protocol changes without changing effective embedding scope
- **THEN** existing current embeddings remain reusable and no corpus rebuild is required

#### Scenario: Embedding credential rotates

- **WHEN** only the credential for the same effective embedding endpoint rotates
- **THEN** existing current embeddings remain reusable after capability testing passes

### Requirement: Background indexing reloads the canonical source

Every embedding job MUST carry the target effective embedding scope and canonical source locator, not a generation connection or arbitrary composite runtime transport. On execution, the worker MUST resolve the exact retained revision's effective embedding connection, reload the authorized canonical source, recompute semantic input and hash, and upsert only when the recomputed hash matches the job target. Missing, disabled, or unusable embedding connection state MUST produce the existing bounded retry/failure behavior without using generation as fallback.

#### Scenario: Activation occurs while an old job is queued

- **WHEN** a job for a retained scope executes after another composite becomes active
- **THEN** it resolves the exact retained revision's embedding connection rather than the new active generation connection

#### Scenario: A queued live record changes before processing

- **WHEN** reloaded canonical content hashes differently from the queued target
- **THEN** the worker does not write the stale target and schedules or relies on the current hash path

#### Scenario: A queued record is deleted

- **WHEN** the canonical source locator no longer resolves
- **THEN** the worker records a bounded terminal outcome without persisting stale text or vectors

#### Scenario: Embedding provider fails

- **WHEN** the exact embedding connection is unavailable during a job
- **THEN** the job follows bounded retry/failure policy and never sends content to the generation connection
