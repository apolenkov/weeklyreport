## Why

CoreDev already used onUI for developer-local visual review, while WeeklyReport needed the same canonical developer workflow. A retired user-level Agentation SQLite store also remained on the workstation. One local workflow was needed so review feedback would reach Codex consistently without changing either product's feedback surface.

## What Changes

- Standardize `onui-local` as the developer-local visual-review interface for active repositories `/Users/wrk/work/coredev` and `/Users/wrk/work/weeklyreport`.
- Fix canonical review origins at `http://127.0.0.1:4177` for CoreDev and `http://localhost:3000` for WeeklyReport.
- Add the minimal WeeklyReport agent guidance for reading, tracing, verifying, and closing onUI annotations.
- Retire the dormant user-level Agentation store at `/Users/wrk/.agentation` without archive or import, after an exact-target check confirms it is the intended local-tooling path for the retired SQLite store.
- Keep onUI external to the product. Preserve WeeklyReport's active Agentation product feedback, PostgreSQL adapter, and durable [authenticated-product-feedback](../../specs/authenticated-product-feedback/spec.md) contract.

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
- User environment: existing `onui-local` registration and explicit scope of the dormant `/Users/wrk/.agentation` data in local-tooling cleanup actions.
- CoreDev: read-only conformance reference at `AGENTS.md`; the former `docs/research/onui-unification-agentation-replacement-2026-09-03.md` lived in the CoreDev repository and was removed there in `15d834d9`.
