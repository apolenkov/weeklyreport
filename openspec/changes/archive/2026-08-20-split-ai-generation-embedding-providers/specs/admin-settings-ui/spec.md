## ADDED Requirements

### Requirement: Provider form configures two connection roles as one revision

The Settings → AI → Provider surface MUST remain one universal lifecycle form. Its expanded editor MUST show a required **Generation** section and an **Embeddings** section. Generation MUST contain provider, custom endpoint when applicable, credential, planner model, answer model, and the existing reasoning control. Embeddings MUST contain a mode with exactly **Same connection as generation** and **Separate connection**; separate mode MUST reveal provider, custom endpoint when applicable, credential, and embedding model. The form MUST use server-owned role metadata to exclude profiles unsupported for that section and MUST submit one composite draft through `admin.aiProvider.save`.

#### Scenario: Administrator configures OpenAI with Jina

- **WHEN** the administrator selects OpenAI for Generation and Separate connection with Jina for Embeddings
- **THEN** the form collects each role's model and credential in its own section
- **AND** one Save action creates one revision

#### Scenario: Administrator reuses generation

- **WHEN** the administrator selects Same connection as generation
- **THEN** independent embedding provider, endpoint, and credential controls are hidden and omitted
- **AND** the embedding model remains editable

#### Scenario: Role-incompatible profile is unavailable

- **WHEN** the administrator opens a role's provider selector
- **THEN** Jina is absent from Generation and Groq is absent from Embeddings according to profile metadata

#### Scenario: Existing single-connection revision is edited

- **WHEN** an administrator opens a migrated revision
- **THEN** the form renders Same connection as generation with its existing model and masked credential state

### Requirement: Composite test feedback remains connection-scoped and actionable

The Settings AI provider lifecycle MUST start and poll one durable composite test execution, but it MUST group safe progress and terminal checks under **Generation** and **Embeddings**. It MUST retain the draft values after any failure, distinguish incompatible, configuration-error, and inconclusive outcomes, and MUST NOT display credentials, response bodies, parser exceptions, or duplicate copies of the same connection failure. Reasoning and detected answer protocol MUST appear only with Generation; measured vector dimensions MUST appear only with Embeddings.

#### Scenario: Separate embedding authentication fails

- **WHEN** generation checks pass and embedding authentication fails
- **THEN** Generation displays its passing result and Embeddings displays one bounded authentication failure
- **AND** activation remains unavailable

#### Scenario: Reused connection is throttled

- **WHEN** a reused generation connection receives a throttle and later checks are skipped
- **THEN** the UI presents one connection-level inconclusive explanation with affected groups
- **AND** it does not repeat raw provider errors for every skipped capability

#### Scenario: Testing survives reload

- **WHEN** the administrator reloads while either lane is queued or running
- **THEN** the form restores the composite progress from the server read model and continues polling

### Requirement: Credential editing is explicit for each connection

The form MUST show masked credential presence independently for Generation and separate Embeddings. Leaving a credential blank MUST be described as retention only when the selected profile and endpoint identity are unchanged from the base revision. Changing either MUST require a new credential inline. Same-connection mode MUST NOT render or submit a second credential.

#### Scenario: Endpoint changes with blank credential

- **WHEN** an administrator changes one connection endpoint and leaves its credential blank
- **THEN** the form reports that a new credential is required before save

#### Scenario: Unchanged separate embedding credential is retained

- **WHEN** profile and endpoint are unchanged and the administrator leaves the masked embedding credential field blank
- **THEN** the form submits explicit retention intent without receiving the stored secret
