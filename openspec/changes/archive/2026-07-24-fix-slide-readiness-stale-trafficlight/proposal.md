## Why

The slide can show a green product badge while marking the same section
Blocked and requiring “Explain the red or yellow signal.” P10
(second-vendor re-audit of refuted mass-review findings) traced this to an
Opus-refuted finding that the Codex counter-check confirmed with a persisted
red stage and zero backing risks.

## What Changes

- Derive slide-readiness project severity from the already-built slide product
  projection, the same risk-floored stage model used by the visible product
  badge, instead of reading `project.trafficLight`.
- Preserve the existing readiness aggregation: derived red/yellow products and
  project-scoped risk rows still contribute their existing counts.
- Add regression coverage for stale persisted red with zero risks (derived
  green, no blocked count, no required risk warning) and for a risk-backed red
  project (still counted blocked).

## Evidence

- `section-slide-readiness.ts:110-126` counts red/yellow projects from persisted
  `project.trafficLight`; `:65-81` turns that signal into the required warning,
  and `section-slide-model-helpers.ts:31-48` turns it into the slide tone.
- `stage-status.ts:40-54` collapses an unbacked explicit severity to On Track.
  `section-slide-product-projection.ts:97-120` applies that derivation to stages
  and computes the visible product badge from the derived stage statuses.
- `status-risk-unification/spec.md:12-23,45-62` makes risks the sole severity
  source and requires stale unbacked severity to render On Track.
- The stale value remains reachable: `reports.router.ts:76-87` accepts
  `draftSaveSchema`; `section.schema.ts:66-70,220-232` permits red stage status;
  `report-section-merge.ts:55-80` copies it into the owned stage and derives
  `project.trafficLight`; `save-section.derive.ts:9-31` persists both values.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `status-risk-unification` — slide readiness must consume the unified,
  risk-derived slide status model rather than persisted project traffic lights.

## Impact

- `apps/web/src/features/slides/model/section-slide-readiness.ts`
- `apps/web/src/features/slides/model/section-slide-utils.test.ts`
- No API, database, schema, migration, or dependency change.

## Non-goals

- Not changing `draftSaveSchema`, stage/project-status write inputs,
  `mergeSection`, or persistence. Removing legacy severity writes is a separate
  concern and must be proposed independently against `status-risk-unification`.
- Not changing traffic-light completeness or foreign-health behavior.
- Not redesigning readiness counts or warning copy.
