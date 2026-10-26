# Proposal

## Why

Two period flows act after their transaction has committed, and each lets a
failing reporting step change the outcome the caller sees:

- C1165: `emitPublishSideEffects` guards telemetry and cache, but a throwing
  `onSideEffectError` (the failure report) rejects the call and can fail a
  committed publish. A throwing report after the telemetry step also skips the
  cache invalidation.
- C1207: `AutoArchiverScheduler.archiveCandidate` emits the audit inside the
  same `try` as the archive. A throwing audit after the commit reports an
  archived period as `failed` (inflated `failures`, missing from `periodIds`).

Both follow the contract accepted for TASK-503.32: post-commit reporting is
best-effort and never replaces the committed outcome.

## What Changes

- A failing failure-report in publish side effects does not reject the call and
  does not skip the other side effect.
- An audit failure after a committed auto-archive keeps the period in
  `periodIds`; the failure is logged, not added to `failures`.
- No new sink, flag or configuration.

## Evidence limits

The throwing callback and the throwing audit sink are fault injections. Neither
is an admitted production path today (`wave2/claude-E-C1165-C1207/SOURCE-PREFLIGHT.md`:
the production logger does not throw synchronously). They state the contract as
defense in depth, like TASK-503.32.

## Remaining clause (no RED)

| Clause | Why no RED from source                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1177  | Reopen check-then-act interleaving needs a coordinated disposable-DB run of two targets plus a publish; a global unique index conflicts with the admin exemption, so no blind guard. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `publish-compare-and-set`: the failure report of a post-publish side effect
  throwing does not fail the committed publish or skip the other side effect.
- `period-scheduler-wiring`: a throwing auto-archive audit after the committed
  archive keeps the period in the archived outcome and out of `failures`.
