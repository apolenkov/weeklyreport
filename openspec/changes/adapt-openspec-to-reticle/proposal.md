## Why

WeeklyReport has a normative OpenSpec corpus but no durable way to tell which user-facing scenarios Reticle proves, which flow proves them, or which scenarios cannot be exercised through the browser. The exact scenario and outcome denominators must come from the accepted source snapshot, because the corpus can change. The existing saved flows are useful runtime evidence, yet they are not traceable to the complete specification denominator.

## What Changes

- Add a version 2 proof registry with exactly one source entry for every current `openspec/specs/*/spec.md` normative `THEN`/`AND` outcome, preserving its structured identity, exact text, and fingerprints.
- Keep new entries explicitly `unclassified`; after review, classify each outcome with a non-empty array of required Reticle and/or deterministic proofs. One source outcome may require both surfaces.
- Link every required browser proof to a specific saved flow consequence and require business intent, a predeclared consequence, a live `verified: yes` verdict, and successful replay.
- Add a TypeScript gate that rejects missing, stale, duplicate, empty, or structurally unsupported proof bindings while keeping volatile runtime receipts outside Git.
- Preserve deterministic tests and reviewed evidence as the acceptance authority; Reticle remains runtime evidence and does not replace them.

### Non-goals

- Generating product tests or Reticle flows from prose.
- Treating an unavailable fixture, environment failure, or product defect as not applicable.
- Changing third-party Reticle packages or fixing unrelated product defects found during verification.
- Running destructive, production, shared-data, credential, or paid flows.

## Capabilities

### New Capabilities

- `reticle-spec-traceability`: Complete, drift-detecting traceability from normative OpenSpec outcomes to Reticle consequences or explicit deterministic evidence surfaces.

### Modified Capabilities

None.

## Impact

The change adds one tracked Reticle coverage registry, a focused TypeScript validator and test, a root package gate, saved flows needed by applicable scenarios, and this OpenSpec capability. It does not change product APIs, persisted data, dependencies, or the advisory boundary in `behavioral-ui-regression-gate`.
