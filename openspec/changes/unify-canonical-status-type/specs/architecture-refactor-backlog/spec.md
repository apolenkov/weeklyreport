# architecture-refactor-backlog Delta

## MODIFIED Requirements

### Requirement: The traffic-light value is a recorded single-source-of-truth target

The backlog MUST record that the traffic-light status value is unified behind
one source of truth: `trafficLightStatusSchema` and its inferred
`TrafficLightStatus` type in `packages/shared`
(`report-primitives.schema.ts`), landed by `unify-traffic-light-status-type`
on 2026-07-10, consistent with `schema-conventions` and pinned by the
`traffic-light-status-type` spec. The original "~33 files re-typing
(green/amber/red)" phrasing is corrected by the landed inventory: 18 source
files and 6 test files re-declared the `green/yellow/red` union ("amber"
occurs in the workspace only as Tailwind CSS classes, never as a status
value); all now import the shared type. The TARGET IS CLOSED. The lint
regression gate for literal-union re-declaration is ALSO CLOSED — landed by
`add-status-ssot-lint-gate` (the `status-type-ssot-gate` spec). The
presentation vocabulary's triple declaration is ALSO CLOSED — consolidated
by `unify-canonical-status-type` behind `CanonicalStatus`
(`status-presentation-model` spec). The remaining named follow-up stays open
as a separate future change: deduplicating `TRAFFIC_RANK` / `statusSeverity`
ranking logic.

#### Scenario: the traffic-light SSOT is discoverable

- **WHEN** a maintainer searches for the traffic-light status contract
- **THEN** the backlog names `packages/shared` `report-primitives.schema.ts`
  as the single home, records the target as closed by
  `unify-traffic-light-status-type`, and links the
  `traffic-light-status-type` spec
- **AND** it records the lint gate and the presentation-vocabulary
  consolidation as closed and names the one remaining deferred follow-up
  (ranking-logic dedup) as a future change
