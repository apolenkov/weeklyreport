# Phase 41 Plan - Park AI Telemetry Scope

## Goal

Close Phase 41 for current v8.1 scope by moving AI eval/telemetry/integration
work to future backlog and keeping current seed-mode AI boundaries intact.

## Tasks

- [x] Remove the started `cr_ai_*` metrics change from current code.
- [x] Capture future AI telemetry/eval work in `.planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md`.
- [x] Keep Phase 54 seed-mode/TODO activation boundary as current truth.

## Verification

- `git diff -- apps/api/src/infrastructure/metrics/metrics.registry.ts` is
  empty for Phase 41 metrics.
