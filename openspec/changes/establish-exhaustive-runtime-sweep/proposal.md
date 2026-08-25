## Why

The current catalog sweep proves that role-reachable pages load, but it does not
produce a complete, SHA-bound account of the controls, deterministic domain
states, transitions, failure paths, accessibility, and visual outcomes exercised
inside each page. The gap is visible in `e2e/sweep/catalog-sweep.spec.ts`,
`e2e/sweep/driver/drive-prompt.md`, and the intentionally high-level contract in
`openspec/specs/behavioral-ui-regression-gate/spec.md`.

## What Changes

- Add an Exhaustive Runtime Sweep that derives coverage cells at run time from
  the live Chromium desktop DOM and the domain oracle.
- Bind every cell and artifact to one source SHA, seed/profile state, role,
  route, viewport, action, oracle, and terminal verdict.
- Exercise deterministic nominal, boundary, lifecycle, permission, and
  controlled-failure states against a disposable E2E database.
- Allow the frozen deterministic matrix to run through bounded parallel lanes.
  Every lane owns a distinct disposable database, Redis instance, API/web
  ports, browser process, and archive subtree; only the validated merger may
  publish canonical coverage.
- Keep the immutable baseline separate from fixes; rerun affected cells after
  each fix and the full matrix before completion.
- Preserve completed reveal-discovery work across bounded child restarts. An
  exact-canary continuation uses immutable terminal-candidate receipt chunks
  containing disjoint suffixes and a pure parent-owned reducer, is
  source/state/selector/route/surface bound, durable, and valid only at a
  terminal completed-candidate boundary. The child emits no PASS; the parent
  alone seals execution grants, reduces an empty frontier, and writes canary
  PASS. No raw or sealed continuation can authorize a full-preflight launch.
  Full/shard journal continuation remains explicitly NOT-PROVEN in this change
  and cannot reuse canary artifacts.
- Make that continuation economical on a constrained Darwin host: keep one
  headless Playwright worker, refresh the child/browser process at bounded
  time, terminal-candidate, or reveal-action boundaries, and require a
  parent-owned host checkpoint after every successful child, including the
  terminal child. Treat absolute swap occupancy as canonical telemetry rather
  than a standalone veto; fail closed on current pressure, reclaimable
  capacity, compression, swap headroom, attempt-relative growth/activity, and
  counter integrity.
- Preserve the first terminal-candidate failure of a diagnostic capacity survey
  in a separately identified, bounded failure-frontier packet before attempting
  another opaque full traversal. The packet binds the exact source, plan,
  selector, state, route, branch, canonical candidate list and failing index,
  but never grants continuation, resume, PASS, canary, capacity-result or
  acceptance authority. A focused replay must re-derive the saved candidate
  from fresh exact-source state instead of trusting a serialized raw action.
- Keep native Codex `gpt-5.6-luna` Max reviews bounded to canonical role/profile
  evidence batches. Reports use the `native-codex` provider contract, emit
  candidates only, and require an explicit verifier import before any merge;
  one primary orchestrator owns the canonical ledger and `gpt-5.6-sol` remains
  in charge of architecture, planning, and final synthesis.
- Require zero unresolved or confirmed functional, accessibility, and visual
  gaps at the final SHA.

### Non-goals

- Firefox, WebKit, mobile, tablet, production data, and server-side CI.
- A frozen per-element BDD catalog or an unbounded claim over arbitrary inputs
  and event sequences.

## Capabilities

### New Capabilities

- `exhaustive-runtime-sweep`: Declared matrix, typed coverage cells, deterministic
  state/failure execution, evidence binding, adjudication, and stop gate.

### Modified Capabilities

- `behavioral-ui-regression-gate`: Promote run-time within-route coverage from an
  unmeasured Driver responsibility to a blocking, measured campaign verdict.
- `ai-driver-coverage`: Bind every role drive and candidate disposition to the
  canonical campaign SHA, coverage cell, and evidence ledger.

## Impact

Affected surfaces are `e2e/sweep/`, `e2e/integration/`, deterministic seed/reset
entrypoints under `prisma/`, root test scripts, and archive-backed campaign
reports. No product API or production database contract changes.
