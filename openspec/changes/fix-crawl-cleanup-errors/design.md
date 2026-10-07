## Context

See proposal.md. The synchronous role worker owns one browser session and writes its profile on exit. Node 26 provides explicit resource management.

## Goals / Non-Goals

Keep failure evidence and shutdown attempts intact without changing traversal, recording or database behavior.

## Decisions

Use the native DisposableStack in a using declaration. Register shutdown before profile persistence so LIFO disposal preserves the current profile-first order. The runtime attempts both disposers and retains the primary error in the standard SuppressedError chain. Nested finally blocks would still replace earlier errors; a custom aggregation helper would duplicate the runtime facility.

Wrap driver shutdown failure with session context and the original cause. Do not infer successful closure from an arbitrary transport failure.

## Risks / Trade-offs

- Runtime support is required: the repository pins Node 26 and local runtime probes verify native disposal and suppressed errors.
- Callers receive a SuppressedError for multiple failures: regression tests verify the original errors remain accessible.

## Rollout

No migrations or flags. Period dual-state, role coverage and the destructive database guard are unchanged. Neither API nor web consumers change. Rollback is the group commit.
