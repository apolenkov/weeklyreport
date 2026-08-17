# ai-provider-configuration Specification

## Purpose

Define the organization-wide, administrator-managed AI provider configuration and its safe lifecycle.

## Requirements

### Requirement: Only administrators manage the global AI integration

The `admin.aiProvider` tRPC surface and Settings → AI → Provider card MUST use the canonical `adminProcedure` for every configuration read, draft write, test, activation, disable, rollback, and progress operation. The system MUST maintain one organization-wide active AI configuration and MUST NOT expose per-user, per-role, or per-feature provider overrides.

#### Scenario: Admin manages the integration

- **WHEN** an authenticated user with role `admin` opens the AI integration card or submits a valid configuration operation
- **THEN** the system permits the operation through `adminProcedure`

#### Scenario: Non-admin attempts configuration access

- **WHEN** a lead, head, viewer, or unauthenticated caller invokes an AI configuration procedure
- **THEN** canonical role middleware rejects the call before configuration or credential data is read

#### Scenario: Authorized users invoke an AI feature

- **WHEN** any existing AI feature passes its own role and data-authorization gates
- **THEN** it uses the same global active configuration revision regardless of the caller
- **AND** this change does not grant that feature to any additional role

### Requirement: Supported profiles include approved custom models

The configuration contract MUST support `mistral`, `openrouter`, and `custom-openai-compatible` profiles. Built-in profiles MUST select their fixed base URL; the custom profile MUST accept a normalized base URL and free-form planner, answer, and embedding model identifiers. Every resolved base URL MUST match an origin explicitly supplied by deployment configuration, and the API MUST reject user-info, query, fragment, redirect, or non-allowlisted targets before making a request.

#### Scenario: Admin selects a built-in profile

- **WHEN** the admin saves Mistral or OpenRouter with valid model identifiers and a credential
- **THEN** the server resolves the profile's fixed base URL and verifies its origin against deployment policy

#### Scenario: Admin selects an approved corporate endpoint

- **WHEN** the admin saves a custom OpenAI-compatible base URL whose normalized origin is allowlisted
- **THEN** the system accepts the endpoint and its custom model identifiers for capability testing

#### Scenario: Admin submits an unsafe endpoint

- **WHEN** the custom URL contains user info, a query, a fragment, follows a redirect, or resolves to an origin absent from the deployment allowlist
- **THEN** the system rejects it without sending a credential or synthetic test payload

### Requirement: Provider credentials remain secret at every boundary

The configuration repository MUST persist provider credentials using authenticated encryption under a required environment-owned master key. Shared schemas, `admin.aiProvider` responses, the Integrations UI, jobs, audit events, logs, traces, metrics, and client errors MUST NOT expose plaintext credentials or stored ciphertext. Read models MUST expose only whether a credential exists and an optional masked suffix.

#### Scenario: Admin saves a provider credential

- **WHEN** a valid credential is submitted for a draft revision
- **THEN** the repository stores authenticated ciphertext and encryption metadata rather than plaintext

#### Scenario: Admin reads an existing configuration

- **WHEN** the configuration has a stored credential
- **THEN** the response reports that a credential is configured and may show a masked suffix
- **AND** neither plaintext nor ciphertext is returned

#### Scenario: Encryption configuration is missing

- **WHEN** the API boots without the required encryption master key or with an invalid key shape
- **THEN** validated environment configuration fails boot with a specific error

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

### Requirement: Activation is atomic and preserves service during preparation

The `admin.aiProvider.activate` operation MUST express an administrator's intent to make one validated revision global. If its embedding scope differs from the active scope, the system MUST keep the old revision active while the new scope is prepared, expose exact completed, total, failed, and elapsed status, and atomically change the global active pointer only after preparation is complete. If the scope is unchanged, activation MUST NOT rebuild embeddings.

#### Scenario: Provider or embedding scope changes

- **WHEN** an admin activates a validated revision with a different endpoint identity, embedding model, dimensions, or semantic-input version
- **THEN** the revision enters preparation and the old revision continues serving all users
- **AND** the pointer changes only after the new scope satisfies the semantic readiness gate

#### Scenario: Only credential or generation models change

- **WHEN** an admin activates a validated revision whose embedding scope equals the active scope
- **THEN** the system atomically activates it without reindexing the corpus

#### Scenario: Preparation fails

- **WHEN** any required embedding remains failed or missing after bounded retries
- **THEN** the candidate revision is not activated
- **AND** the prior configuration continues serving users without automatic fallback to any third provider

### Requirement: Provider activation proves every active AI feature

Before a candidate provider becomes globally active, the provider lifecycle MUST
evaluate every active registered feature prompt bundle against that exact
candidate provider revision. The compatibility result MUST include the prompt
revision, content hash, contract version, evaluator version, bounded outcome, and
safe check results. A stale or failed feature evaluation MUST preserve the
previous provider pointer and MUST NOT start embedding preparation.

#### Scenario: An active feature is incompatible with a candidate provider

- **WHEN** generic provider capability checks pass but an active feature prompt
  evaluator fails
- **THEN** the candidate remains inactive with a safe compatibility failure
- **AND** the existing provider and embedding preparation state are unchanged

### Requirement: Unconfigured and disabled states are explicit

The admin MUST be able to disable the global integration without deleting its retained configuration. An authenticated availability read used by AI product surfaces MUST reveal only `available` or `not_configured`, not provider details. When no configuration is active or the integration is disabled, AI controls MUST remain visible but disabled with English explanatory copy, and direct assistant calls MUST return the controlled `ai_not_configured` outcome. Non-AI report workflows MUST remain available.

#### Scenario: Fresh installation has no active configuration

- **WHEN** an authorized user reaches an AI surface before an admin activates a configuration
- **THEN** the control is disabled and explains that AI is not configured by an administrator
- **AND** report viewing, editing, saving, submission, review, and publication keep their existing behavior

#### Scenario: Admin disables AI

- **WHEN** an admin confirms the disable operation
- **THEN** subsequent AI availability reads return `not_configured`
- **AND** the retained credential is not exposed or deleted

### Requirement: Configuration lifecycle changes are auditable

The control plane MUST audit draft saves, tests, activation requests, activation success or failure, disables, manual restoration of a retained revision, and legacy bootstrap. Each event MUST identify the admin actor when applicable, revision, profile, model identifiers, safe transition, and timestamp, and MUST exclude credentials, provider response bodies, prompts, report data, and embeddings.

#### Scenario: Admin activates a tested revision

- **WHEN** activation begins and later succeeds or fails
- **THEN** the audit trail contains the request and terminal transition with safe configuration metadata
- **AND** it contains no secret or provider payload

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
