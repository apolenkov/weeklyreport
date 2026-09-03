## Why

CoreDev already uses onUI for local visual review, while WeeklyReport has no canonical annotation workflow and retired Agentation data remains on the workstation. One local workflow is needed so feedback reaches Codex consistently without adding review tooling to either product bundle.

## What Changes

- Standardize `onui-local` as the developer-local visual-review interface for active repositories `/Users/wrk/work/coredev` and `/Users/wrk/work/weeklyreport`.
- Fix canonical review origins at `http://127.0.0.1:4177` for CoreDev and `http://localhost:3000` for WeeklyReport.
- Add the minimal WeeklyReport agent guidance for reading, tracing, verifying, and closing onUI annotations.
- Retire the dormant Agentation store at `/Users/wrk/.agentation` without archive or import, after an exact-target check confirms no active Agentation process/configuration.
- Keep SitePing outside this capability: it owns authenticated product feedback under the linked `add-authenticated-siteping-feedback` change.

### Non-goals

- No onUI package, source, extension artifact, or GPL-licensed code in a product repository or deployment.
- No shared/team annotation store, user identity, RBAC, product comments, or report lifecycle integration.
- No edits to CoreDev's dirty implementation tree or historical Agentation evidence.
- No changes to `/Users/wrk/work/customreport-archive`.

## Capabilities

### New Capabilities

- `developer-ui-feedback-tooling`: one local onUI/Codex review workflow with canonical page identity, evidence-bound closure, and recoverable tooling rollback.

### Modified Capabilities

None.

## Impact

- WeeklyReport: `AGENTS.md`, OpenSpec artifacts, local acceptance only.
- User environment: existing `onui-local` registration and explicit removal of dormant `/Users/wrk/.agentation` data.
- CoreDev: read-only conformance reference at `AGENTS.md` and `docs/research/onui-unification-agentation-replacement-2026-09-03.md`.
