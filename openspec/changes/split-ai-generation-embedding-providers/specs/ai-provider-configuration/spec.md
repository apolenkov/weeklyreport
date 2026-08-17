## ADDED Requirements

### Requirement: AI configuration revisions bind generation and embedding connections atomically

The shared `aiProviderDraftSchema`, `AiProviderConfiguration` persistence model, and `admin.aiProvider` procedures MUST treat one revision as an immutable composite containing exactly one generation connection and one effective embedding connection. Generation MUST own planner and answer models plus reasoning and answer-protocol settings. Embeddings MUST either reuse the generation profile, endpoint, and credential or define one separate profile, endpoint, and credential. The system MUST NOT expose independent active pointers or lifecycle operations for the two connections.

#### Scenario: Administrator chooses separate providers

- **WHEN** an administrator saves OpenAI or Groq for generation and Mistral or Jina for embeddings with valid role-specific fields
- **THEN** one draft revision contains both connections and their model identifiers
- **AND** neither connection becomes active independently

#### Scenario: Embeddings reuse generation

- **WHEN** an administrator selects `reuse_generation`
- **THEN** the revision derives the effective embedding profile, endpoint, and credential from generation
- **AND** it stores no independent embedding credential

#### Scenario: Invalid partial separate connection is submitted

- **WHEN** separate mode omits a required embedding profile, endpoint, credential, or model
- **THEN** the shared contract rejects the draft before persistence or provider work

## MODIFIED Requirements

### Requirement: Supported profiles include approved custom models

The configuration contract MUST use one role-aware provider-profile registry. It MUST support `mistral`, `openrouter`, `openai`, `groq`, `jina`, and `custom-openai-compatible`; generation MUST allow Mistral, OpenRouter, OpenAI, Groq, and custom profiles, while embeddings MUST allow Mistral, OpenRouter, OpenAI, Jina, and custom profiles. Built-in profiles MUST select their fixed base URL and declare their supported roles. The custom profile MUST accept a normalized base URL and free-form model identifiers for its selected role. Every resolved base URL MUST match an origin explicitly supplied by deployment configuration, and the API MUST reject user-info, query, fragment, redirect, or non-allowlisted targets before making a request.

#### Scenario: Administrator selects a role-compatible built-in profile

- **WHEN** the administrator selects Groq for generation or Jina for separate embeddings with valid model identifiers and credentials
- **THEN** the server resolves the profile's fixed base URL and verifies its origin against deployment policy

#### Scenario: Administrator selects a role-incompatible profile

- **WHEN** the administrator submits Jina for generation or Groq for embeddings
- **THEN** shared and server validation reject the connection before any provider request

#### Scenario: Administrator selects an approved custom endpoint

- **WHEN** the administrator saves a custom OpenAI-compatible base URL whose normalized origin is allowlisted for the selected connection role
- **THEN** the system accepts the endpoint and custom model identifiers for capability testing

#### Scenario: Administrator submits an unsafe endpoint

- **WHEN** either custom URL contains user info, a query, a fragment, follows a redirect, or resolves to an origin absent from the deployment allowlist
- **THEN** the system rejects the composite draft without sending any credential or synthetic payload

### Requirement: Provider credentials remain secret at every boundary

The configuration repository MUST persist each independent provider credential using authenticated encryption under a required environment-owned master key and connection-role-specific authenticated data. Shared schemas, `admin.aiProvider` responses, Settings UI, jobs, audit events, logs, traces, metrics, and client errors MUST NOT expose plaintext credentials or stored ciphertext. Read models MUST expose only role-specific credential presence and an optional masked suffix. A new revision MAY inherit encrypted credential material from its base revision only for a connection whose profile and normalized endpoint identity are unchanged; a changed connection MUST require a new credential. Reuse-generation mode MUST reject an embedding credential.

#### Scenario: Administrator saves two credentials

- **WHEN** a valid separate generation and embedding credential are submitted
- **THEN** the repository stores two independently authenticated encryption envelopes rather than plaintext

#### Scenario: Administrator retains an unchanged credential

- **WHEN** the base revision's connection profile and endpoint identity are unchanged and its credential input is blank
- **THEN** the server carries that role's encrypted credential into the new immutable revision

#### Scenario: Administrator changes an endpoint without a credential

- **WHEN** a connection profile or normalized endpoint identity changes and no new credential is supplied
- **THEN** save fails with a bounded field error and the prior secret is not reused

#### Scenario: Administrator reads an existing configuration

- **WHEN** either connection has a stored credential
- **THEN** the response reports role-specific credential presence and may show masked suffixes
- **AND** neither plaintext nor ciphertext is returned

#### Scenario: Encryption configuration is missing

- **WHEN** the API boots without the required encryption master key or with an invalid key shape
- **THEN** validated environment configuration fails boot with a specific error

### Requirement: Draft configurations prove required capabilities before activation

The `admin.aiProvider.test` operation MUST durably execute role-scoped synthetic checks for the exact composite revision. The generation lane MUST verify authentication, timeout handling, one forced planner tool call with parallel calls disabled, tested reasoning translation, answer-protocol negotiation, token usage, and active-feature compatibility. The embedding lane MUST verify authentication, batch embeddings, finite ordered vectors, and one consistent positive vector length without sending a dimensions option. Requests MUST be sequential within each lane. A terminal authentication, configuration, throttling, timeout, transport, or provider/server result MUST stop subsequent requests on the affected connection; when both roles reuse it, both lanes MUST stop. The composite MUST become validated only when both lanes pass, and safe role-scoped status MUST exclude provider response bodies.

#### Scenario: Both connection lanes pass

- **WHEN** every generation and embedding check passes for the exact composite identity
- **THEN** the draft stores the measured dimensions and tested answer protocol and becomes eligible for activation

#### Scenario: Generation fails but separate embeddings pass

- **WHEN** the generation lane is incompatible and the independent embedding lane passes
- **THEN** the revision remains inactive with separate bounded lane results
- **AND** the current active revision is unchanged

#### Scenario: A shared connection has a terminal failure

- **WHEN** reuse-generation mode receives an authentication failure, throttle, timeout, transport failure, or provider/server failure
- **THEN** no later generation or embedding request is sent through that connection
- **AND** transient failures are recorded as inconclusive rather than incompatibility

#### Scenario: Administrator saves without vector dimensions

- **WHEN** an administrator saves both connections and model identifiers
- **THEN** the draft contains no administrator-supplied dimensions
- **AND** dimensions are derived only from a passing synthetic embedding response

#### Scenario: Test runs against synthetic content

- **WHEN** either connection is tested
- **THEN** no report question, record, user identifier, entity name, prompt body, generated answer, or existing embedding is sent or persisted

#### Scenario: Administrator retests the active composite

- **WHEN** an administrator tests the revision selected by `AiProviderControl.activeConfigurationId`
- **THEN** the system persists current safe lane results without changing its active lifecycle, pointer, or availability

### Requirement: Activation is atomic and preserves service during preparation

The `admin.aiProvider.activate` operation MUST express intent to activate one validated composite revision. It MUST transactionally verify current passing generation evidence, embedding evidence, active-feature prompt compatibility, and the exact candidate identity. If the effective embedding scope differs from the active scope, the system MUST keep the old composite active while the candidate scope is prepared, expose exact completed, total, failed, and elapsed status, and atomically change the single global pointer only after preparation is complete. If the embedding scope is unchanged, activation MUST NOT rebuild embeddings. Runtime MUST never serve a mixed pair from different revisions.

#### Scenario: Effective embedding scope changes

- **WHEN** an administrator activates a validated revision with a different effective embedding endpoint identity, model, dimensions, or semantic-input version
- **THEN** the candidate enters preparation and the previous composite continues serving all users
- **AND** the pointer changes only after the new scope satisfies the semantic readiness gate

#### Scenario: Only generation or embedding credential changes

- **WHEN** current passing evidence exists and the candidate's embedding scope equals the active scope
- **THEN** the system atomically activates the whole candidate without rebuilding the corpus

#### Scenario: Preparation fails

- **WHEN** any required embedding remains failed or missing after bounded retries
- **THEN** the candidate does not activate and the prior composite continues serving
- **AND** neither connection falls back to any other provider

#### Scenario: Evidence becomes stale

- **WHEN** either connection identity, active prompt identity, profile-registry version, or evaluator version changes after testing
- **THEN** activation fails closed without moving the active pointer

### Requirement: Provider activation proves compatibility with active feature prompts

Provider testing MUST evaluate every active registered AI-feature prompt bundle against the candidate's exact `generationCompatibilityIdentity` using synthetic non-product data. The identity MUST cover generation endpoint semantics, credential version fingerprint, planner and answer models, reasoning configuration, selected answer protocol, request policy, contract version, and evaluator version. Prompt compatibility MUST NOT depend on the embedding connection or composite revision ID. Activation MUST transactionally combine current passing generation/prompt evidence with current passing embedding evidence for the exact candidate revision. Existing asynchronous execution, bounded outcomes, rate-safe sequencing, reasoning translation, and answer-protocol rules remain mandatory.

#### Scenario: Only embeddings change

- **WHEN** a candidate has the same current generation compatibility identity as a passing active-feature evaluation but a different embedding connection
- **THEN** the system may reuse that generation/prompt evidence for the candidate
- **AND** activation still requires passing embedding evidence and any required scope preparation

#### Scenario: Generation credential or behavior changes

- **WHEN** the credential fingerprint, endpoint semantics, models, reasoning, answer protocol, request policy, contract, or evaluator differs
- **THEN** prior prompt compatibility is stale and generation evaluation must pass again

#### Scenario: Transient generation probe is inconclusive

- **WHEN** a generation or feature check encounters throttling, timeout, transport failure, or provider/server failure
- **THEN** the execution records an inconclusive bounded outcome and stops later requests on that connection
- **AND** it does not claim model, prompt, reasoning, or protocol incompatibility

#### Scenario: Both connection identities are current

- **WHEN** generation, active-feature, and embedding evidence all pass and match the exact candidate at activation time
- **THEN** the revision may proceed through preparation and atomic activation

### Requirement: Existing Mistral service is bootstrapped once without a runtime fallback

An explicit idempotent rollout operation MUST create an encrypted active Mistral composite revision from the legacy validated environment configuration only when no AI control or configuration row exists. The created revision MUST use `reuse_generation`, one legacy credential, the legacy planner, answer, and embedding models, and the approved global endpoint. Normal runtime resolution MUST NOT fall back to legacy environment values.

#### Scenario: Existing deployment is upgraded

- **WHEN** bootstrap runs against a database with no AI configuration and complete legacy Mistral values
- **THEN** it creates one active Mistral reuse-generation revision and records the bootstrap

#### Scenario: Bootstrap is repeated

- **WHEN** any AI control or configuration row already exists
- **THEN** the operation leaves all rows and the active pointer unchanged

#### Scenario: Obsolete regional setting is absent

- **WHEN** the API boots or bootstrap runs without `MISTRAL_API_SERVER`
- **THEN** environment validation and bootstrap succeed when all required legacy credential and model values are present
