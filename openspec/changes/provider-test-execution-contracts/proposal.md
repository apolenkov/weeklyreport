# Proposal

## Why

TASK-503.50 returns dispositions for eight wave8 provider-testing clauses (C0890, C0912,
C0935, C0937, C0939, C0946, C0956, C0958). Reading the current source shows one fixed
clause (C0912, `6edc6f7bd`), two small contract gaps that a unit test can pin (C0890 audit
semantics, C0956 suite-version safety of the unique-identity fallback), and five clauses
that need a database, Redis or load observation before any product change is justified.

## What Changes

- `AiProviderDraftService.test` records `ai_provider.test_queued` only when it actually
  enqueued the execution; a request that finds the execution already running enqueues nothing,
  records no queued event and returns the current revision state.
- The retry-identity unique-collision fallback never attaches a caller to an existing
  execution of a different `testSuiteVersion`.
- No change to recovery of a `running` execution whose job is gone, progress writes,
  the control-singleton upsert, execution selection, the activation execution gate or the
  retry-history query: those stay OPEN with native/DB evidence requirements.

## Capabilities

### Modified Capabilities

- `ai-provider-configuration`: adds two requirements next to "Provider test queue handoff is recoverable".

## Impact

`ai-provider.draft-service.ts`, `ai-provider.repository.executions.ts` and tests only.
