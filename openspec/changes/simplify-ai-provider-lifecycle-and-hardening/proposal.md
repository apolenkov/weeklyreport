## Why

The current AI configuration path still carries compatibility-evaluation and
response-protocol plumbing that no longer belongs to the product. It increases
the amount of state administrators must understand and leaves one real user
surface fail-open: the lead report Chat control can become enabled when its
availability procedure is missing. The same lifecycle also has recoverability
gaps around activation races and durable test execution.

## What Changes

- Remove the obsolete active-feature compatibility evaluator, its provider
  lifecycle dependency, result fields, UI, tests, and related response-
  protocol selection/fallback plumbing.
- Keep one code-owned OpenAI-compatible planner/answer protocol and remove the
  legacy JSON Schema fallback and persisted `answerProtocol` contract.
- Make the lead report Chat availability query typed and fail closed whenever
  availability is loading, unavailable, or cannot be read.
- Make prompt/provider pointer swaps fail atomically when their compare-and-set
  loses a race.
- Make durable provider and prompt test executions recoverable after a
  database-to-queue handoff failure, and prevent a running execution from being
  claimed as a second attempt without a lease.
- Remove unreachable Mistral runtime adapters and other dead compatibility
  seams; move Prisma persistence behind the repository architecture boundary.
- Update durable OpenSpec requirements to describe the simplified protocol and
  fail-closed lifecycle.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-provider-configuration`: remove obsolete active-feature compatibility and
  answer-protocol requirements; define atomic activation and recoverable test
  execution.
- `ai-prompt-management`: define atomic pointer activation and recoverable
  asynchronous evaluation execution without provider compatibility gates.
- `lead-report-assistant`: require a typed, fail-closed availability query and
  the single code-owned generation protocol.

## Impact

- Affected API modules: AI provider lifecycle, prompt lifecycle, search
  adapters/runtime, and the asynchronous execution processors.
- Affected shared contracts, Prisma model/bootstrap data, administrator AI
  settings UI, lead report Chat UI, and unit/integration fixtures.
- No new external dependency or user-facing feature is introduced. Existing
  admin authentication, SSRF policy, encrypted credentials, authorization
  boundaries, and report retrieval contracts remain unchanged.
