# Proposal

## Why

Public local dependency commands can mutate whichever Kubernetes context is active even though README.md, docs/kubernetes.md and AGENTS.md declare OrbStack namespace wr-dev. Standalone tester stop also bypasses its existing shared context/namespace guard. D37-V09 C0047/C0092 and real-script argv regressions show the missing admission boundary without contacting a cluster.

## What Changes

- Admit only the declared `orbstack` context before any dependency operation.
- Pin every up/down Kubernetes operation to that admitted context.
- Preserve namespace, manifest and PVC semantics with a shared helper used by the existing scripts.
- Reuse tester target admission for standalone stop, preserving OrbStack/Docker Desktop and wr-tester/wr-tester-* support without requiring a live API pod.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operations-local-readiness`: make the public local dependency target explicit and enforceable.

## Impact

Local-dev up/down, their context helper, tester guard/stop and their operations regression owners change. No runtime/dependency pins, application configuration or production deployment policy changes.

## Non-goals

- Supporting additional local clusters or a confirmation override.
- Running real Kubernetes operations or changing persisted resources.
- Changing tester-kit context support or raw PID ownership policy.
