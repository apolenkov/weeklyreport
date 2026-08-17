## MODIFIED Requirements

### Requirement: Draft configurations prove required capabilities before activation

The `admin.aiProvider.test` operation MUST use synthetic, non-report data to verify generation authentication, timeout handling, one forced `search_report_entries` function call with parallel calls disabled, one JSON Object Mode answer, token-usage parsing, batch embeddings, finite ordered vectors, and one consistent positive embedding-vector length. It MUST persist that measured length only when every blocking smoke check passes. Product-quality evaluations such as multilingual intent selection, exact-versus-semantic choice, aggregation, insufficient-evidence wording, citation behavior, injection resistance, and prompt-budget checks MUST be exposed separately and MUST NOT change provider lifecycle, activation eligibility, or global availability.

#### Scenario: Blocking smoke checks pass

- **WHEN** generation, the forced planner tool, JSON Object Mode answering, usage parsing, and embeddings pass within the configured timeout
- **THEN** the draft becomes validated and eligible for activation

#### Scenario: A blocking smoke check fails

- **WHEN** authentication, the required tool request, answer request, usage parsing, or embedding validation fails
- **THEN** the draft remains inactive with a safe capability-level failure
- **AND** the current active configuration is unchanged

#### Scenario: A product-quality check fails

- **WHEN** a validated provider fails one or more separate quality-evaluation cases
- **THEN** the system records or presents those diagnostic results without changing provider lifecycle, activation eligibility, active pointer, or availability

#### Scenario: Test runs against synthetic content

- **WHEN** the server tests a provider or runs a quality evaluation
- **THEN** no report question, report record, user identifier, entity name, or existing embedding is sent

### Requirement: Provider activation proves the runtime smoke contract

Provider activation MUST require a current passing blocking capability result for the candidate revision. It MUST NOT require a passing stored prompt-bundle evaluation. Activation MUST preserve the existing embedding preparation and atomic pointer-swap behavior.

#### Scenario: Validated provider activates without prompt evaluation

- **WHEN** a candidate has a current passing blocking capability result and its embedding scope is ready
- **THEN** activation succeeds without looking up an exact prompt/provider evaluation

#### Scenario: Capability result is stale or failed

- **WHEN** the candidate lacks a current passing blocking capability result
- **THEN** activation is rejected without changing the active pointer
