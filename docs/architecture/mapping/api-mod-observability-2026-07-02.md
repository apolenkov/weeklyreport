# Mapping — api-mod-observability (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-observability-2026-07-02.md` (2 files).

Domain = `telemetry` (canonical, per Grouping rules Axis 1). Layer = api module-wiring/controller,
Axis 2. Determinism knob #2 (api internal split trigger): a module stays **flat** until it bears a
load-bearing invariant or exceeds ~6 files. `observability` has 2 files, no invariant — stays flat,
no `domain/application/infrastructure` split. Result: both files already sit at their target path.

| Current path                                                | Target path                                                 | Layer                  | Domain    | Move? | Note                                                                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------- | ---------------------- | --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/observability/observability.module.ts  | apps/api/src/modules/observability/observability.module.ts  | module-wiring          | telemetry | no    | Flat module (2 files, no invariant) — under the ~6-file split trigger, so no `domain/application/infrastructure` subsplit applies. |
| apps/api/src/modules/observability/web-vitals.controller.ts | apps/api/src/modules/observability/web-vitals.controller.ts | controller (interface) | telemetry | no    | Public unauthenticated ingest endpoint; already the correct interface-layer file in a flat module — no relocation.                 |

## Summary

- 2/2 files: no move (target == current).
- Moves count: 0.
