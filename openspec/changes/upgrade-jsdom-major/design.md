# Design — Upgrade jsdom 26 → 29

## Context

`jsdom` is the DOM implementation behind the Vitest `jsdom` test environment for
`apps/web` (`apps/web/vitest.config.ts` → `environment: "jsdom"`). It is a
test-only dev dependency, declared once in `apps/web/package.json` at
`^26.1.0`. The registry latest is `29.1.1` — three majors ahead.

jsdom majors routinely change DOM-API behavior (selection/`Range`, `URL`
parsing, `fetch`, `structuredClone` semantics) and lift the minimum Node
version. The repo runs React 19 + Vitest 4 with 70 web test files exercising
Testing Library against this environment, so behavior drift surfaces as test
failures rather than runtime bugs.

This change is part of a Wave-3 dependency-currency effort where each major bump
is isolated into its own change so one breaking dependency cannot sink a batch.

## Decision

**Bump jsdom 26 → 29 as a standalone, isolated change, validated by the full
`apps/web` test suite plus repo gates, with the merge decision left to the user.**

Rationale:

- **Isolation is the right granularity here.** jsdom is a single dev dependency
  with a self-contained validation signal (the web test suite). Bundling it with
  other Wave-3 majors (`typescript`, `@vitejs/plugin-react`, `@types/node`)
  would entangle unrelated failure modes and make a clean revert impossible.
- **The test suite is the acceptance gate.** Because jsdom is test-only, the
  `apps/web` Vitest run is both the risk surface and the proof of correctness. A
  fully-green suite with no skipped/quarantined tests is the bar; making the
  suite green by deleting or skipping tests defeats the purpose.
- **Node baseline is a hard precondition.** The repo pins `node >=24`. If a
  jsdom major requires a higher Node than the repo runs, the bump is blocked and
  must be reported rather than forced.
- **Fix the cause.** DOM-behavior changes (selection, `URL`, `fetch`,
  `structuredClone`) must be migrated by correcting test setup/assertions to the
  new, spec-aligned behavior — not by pinning shims that mask it.

## Alternatives considered

- **Batch with the other Wave-3 majors.** Rejected: violates the locked
  isolation decision and couples unrelated failure modes; a single breaking dep
  would force re-litigating the whole batch.
- **Incremental 26→27→28→29 in separate changes.** Rejected as overkill for a
  test-only dependency. The release notes for all three majors are read up front
  (see `tasks.md` pre-flight), and the test suite catches regressions
  regardless of how many majors are crossed in one step. If migration proves
  unexpectedly large, the work can still be split during implementation.
- **Defer the upgrade.** Rejected: the gap only grows, and a future unrelated
  dependency could force jsdom forward under worse conditions. Landing it now,
  isolated, is the cheapest point to absorb the change.
- **Replace the jsdom environment with `happy-dom`.** Out of scope: that is a
  test-infrastructure change, not a dependency-currency bump, and carries its own
  behavior-parity risk across 70 test files.
