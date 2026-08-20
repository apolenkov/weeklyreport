## ADDED Requirements

### Requirement: Synthetic feature evaluation limits provider concurrency

The `lead-report-assistant` synthetic evaluator MUST execute its remote planner and answer checks with bounded provider concurrency and MUST preserve retryable provider failures as inconclusive safe checks. It MUST NOT create an unbounded `Promise.all` request burst against one provider revision.

#### Scenario: Provider has a constrained request quota

- **WHEN** the evaluator runs all synthetic planner and answer checks for one provider revision
- **THEN** remote checks execute within the configured fixed concurrency bound
- **AND** a local context-budget check remains part of the same bounded result

#### Scenario: One remote check exhausts transient retries

- **WHEN** a remote check receives a retryable provider error after bounded transport retries
- **THEN** that check is persisted as inconclusive with bounded counts
- **AND** no provider response body, prompt body, credential, or generated answer is persisted

#### Scenario: Language planning checks run

- **WHEN** the evaluator checks English and Russian planner input
- **THEN** each scenario uses an unambiguous structured-list request and requires a schema-valid plan
- **AND** exact-versus-semantic routing is judged only by the dedicated retrieval checks

### Requirement: Exact passing compatibility evidence is monotonic

A passing synthetic evaluation for one exact prompt revision, provider generation identity, content hash, contract version, and evaluator version MUST be reusable without another provider call and MUST NOT be overwritten by a later failed or inconclusive evaluation of that same tuple. Non-passing evidence MAY be evaluated again and promoted to passed.

#### Scenario: An identical retry disagrees with an earlier pass

- **WHEN** exact passing compatibility evidence already exists for the active prompt and provider tuple
- **THEN** the system reuses the passing evidence without another synthetic provider call
- **AND** a later failed or inconclusive write cannot downgrade the stored outcome

#### Scenario: An earlier exact evaluation did not pass

- **WHEN** the exact stored evidence is failed or inconclusive and the administrator retests the provider
- **THEN** the synthetic evaluation runs again
- **AND** a passing result promotes the exact tuple to passed

#### Scenario: A new draft matches an active revision that already passed

- **WHEN** legacy shared evidence is non-passing
- **AND** the active provider revision contains exact passing feature evidence for the new draft's generation identity and current prompt tuple
- **THEN** the system promotes and reuses that exact evidence before running synthetic feature probes
- **AND** provider capability testing and durable execution remain scoped to the new draft
