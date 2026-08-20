## REMOVED Requirements

### Requirement: Provider activation proves every active AI feature

**Reason**: Active-feature prompt compatibility evaluation was a legacy
coupling. Prompt bundles are structurally validated and activated independently
of provider testing; the product no longer performs feature-level provider
checks.

**Migration**: Remove `featureCompatibility`, prompt compatibility services,
synthetic prompt probes, prompt-evaluation jobs, and the activation dependency.
Provider activation relies on the provider capability test and embedding
readiness requirements only.

### Requirement: Persisted answer protocol negotiation

**Reason**: The runtime has one code-owned structured-answer protocol. A
persisted protocol selector and JSON Schema fallback were leftovers from the
discarded negotiation design.

**Migration**: Remove `answerProtocol` from shared reads/results, Prisma data,
identities, tests, and adapters. The answer adapter uses the fixed current
protocol.

## MODIFIED Requirements

### Requirement: Draft configurations prove required capabilities before activation

The `admin.aiProvider.test` operation MUST use synthetic, non-report data to
verify authentication, timeout handling, exactly one forced function call with
parallel calls disabled, the fixed structured-answer contract, token usage,
batch embeddings, finite ordered vectors, and one consistent positive
embedding-vector length. It MUST persist that measured length on the revision
only when every required provider capability passes, and MUST NOT send an
embedding-dimensions option to the provider. A draft MUST NOT enter a
validated or preparing state unless every required capability passes. Safe test
status MUST be visible to the admin without provider response bodies.
Retesting an active revision MUST persist the safe result and measurement
without changing its `active` lifecycle, active pointer, or availability.

#### Scenario: All provider capabilities pass

- **WHEN** the provider satisfies every planner, answer, usage, and embedding
  probe within the configured timeout
- **THEN** the draft becomes validated and eligible for activation
- **AND** the result contains only provider capability lanes

#### Scenario: A provider capability fails

- **WHEN** authentication fails, a required parameter is unsupported, output
  violates the fixed answer contract, vectors are invalid, or vectors in the
  batch have different lengths
- **THEN** the draft remains inactive with a safe capability-level failure
- **AND** the current active configuration is unchanged

#### Scenario: Test runs against synthetic content

- **WHEN** the server tests any provider profile
- **THEN** no report question, report record, user identifier, entity name, or
  existing embedding is sent

### Requirement: Activation is atomic and preserves service during preparation

The `admin.aiProvider.activate` operation MUST express an administrator's
intent to make one validated revision global. If its embedding scope differs
from the active scope, the system MUST keep the old revision active while the
new scope is prepared, expose exact completed, total, failed, and elapsed
status, and atomically change the global active pointer only after preparation
is complete. If the scope is unchanged, activation MUST NOT rebuild embeddings.
Every pointer compare-and-set failure MUST abort the transaction and leave the
candidate, prior revision, and pointer unchanged.

#### Scenario: Concurrent activation loses the pointer race

- **WHEN** two administrators activate different validated revisions and one
  compare-and-set loses the race
- **THEN** the losing operation returns a controlled conflict
- **AND** its candidate/superseded lifecycle writes are rolled back
- **AND** exactly one active pointer remains authoritative

### Requirement: Provider test execution is durably recoverable

The provider test request MUST persist one queued execution before enqueueing
its worker job. If enqueueing fails, a later retry of the same revision MUST
reuse and enqueue the existing queued execution instead of treating it as
complete. A worker MUST claim only a queued execution; it MUST NOT claim a
running execution a second time.

#### Scenario: Database succeeds but queue enqueue fails

- **WHEN** the execution row is committed but the worker job is not enqueued
- **THEN** a later test request re-enqueues that queued execution
- **AND** the execution can eventually reach a terminal result

#### Scenario: A running execution is delivered twice

- **WHEN** a duplicate worker delivery arrives after the execution was claimed
- **THEN** only the first `queued → running` claim succeeds
- **AND** the duplicate performs no provider call
