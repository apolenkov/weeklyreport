## MODIFIED Requirements

### Requirement: Draft configurations prove required capabilities before activation

The `admin.aiProvider.test` operation MUST use synthetic, non-report data to verify authentication, timeout handling, exactly one forced function call with parallel calls disabled, strict JSON-schema output, token usage, batch embeddings, finite ordered vectors, and one consistent positive embedding-vector length. It MUST persist that measured length on the revision only when every required capability passes, and MUST NOT send an embedding-dimensions option to the provider. A draft MUST NOT enter a validated or preparing state unless every required capability passes. Safe test status MUST be visible to the admin without provider response bodies. Retesting an active revision MUST persist the safe result and measurement without changing its `active` lifecycle, active pointer, or availability.

#### Scenario: All capabilities pass

- **WHEN** the provider satisfies every planner, answer, usage, and embedding probe within the configured timeout
- **THEN** the draft becomes validated and eligible for activation

#### Scenario: One capability fails

- **WHEN** authentication fails, a required parameter is unsupported, output violates its schema, vectors are invalid, or vectors in the batch have different lengths
- **THEN** the draft remains inactive with a safe field-level or capability-level failure
- **AND** the current active configuration is unchanged

#### Scenario: Admin saves a draft without a vector-size setting

- **WHEN** an admin saves a provider profile, credential, and model identifiers
- **THEN** the system creates a draft without embedding dimensions
- **AND** it derives and persists the dimensions from a successful synthetic embedding response before activation

#### Scenario: Test runs against synthetic content

- **WHEN** the server tests any provider profile
- **THEN** no report question, report record, user identifier, entity name, or existing embedding is sent

#### Scenario: Admin retests the active provider

- **WHEN** an administrator invokes `admin.aiProvider.test` for the revision selected by `AiProviderControl.activeConfigurationId`
- **THEN** the system persists the latest safe capability result and measured dimensions
- **AND** the revision remains `active`, the global pointer remains unchanged, and `ai.availability` remains `available`

### Requirement: Existing Mistral service is bootstrapped once without a runtime fallback

An explicit idempotent rollout operation MUST create an encrypted active Mistral revision from the legacy validated environment configuration only when no AI control or configuration row exists. It MUST do nothing when database configuration already exists. Normal runtime resolution MUST NOT fall back to legacy environment provider values. The bootstrap input MUST NOT include a regional Mistral server selector and MUST create the built-in Mistral revision with its approved global endpoint.

#### Scenario: Existing deployment is upgraded

- **WHEN** the bootstrap runs against a database with no AI configuration and complete legacy Mistral values
- **THEN** it creates one active encrypted Mistral revision at the approved global endpoint and records the bootstrap

#### Scenario: Bootstrap is repeated

- **WHEN** any AI control or configuration row already exists
- **THEN** the operation leaves all rows and the active pointer unchanged

#### Scenario: Obsolete regional setting is absent

- **WHEN** the API boots or the bootstrap runs without `MISTRAL_API_SERVER`
- **THEN** environment validation and the bootstrap succeed when all required legacy credential and model values are present
