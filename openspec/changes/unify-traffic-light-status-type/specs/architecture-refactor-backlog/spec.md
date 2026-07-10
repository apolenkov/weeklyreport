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
value); all now import the shared type. The TARGET IS CLOSED. Named
follow-ups stay open as separate future changes: consolidating the
presentation vocabulary's triple declaration (owned by
`status-presentation-model`), deduplicating `TRAFFIC_RANK` /
`statusSeverity` ranking logic, and a lint regression gate for literal-union
re-declaration.

#### Scenario: the traffic-light SSOT is discoverable

- **WHEN** a maintainer searches for the traffic-light status contract
- **THEN** the backlog names `packages/shared` `report-primitives.schema.ts`
  as the single home, records the target as closed by
  `unify-traffic-light-status-type`, and links the
  `traffic-light-status-type` spec
- **AND** it names the deferred follow-ups (presentation-vocabulary
  consolidation, ranking-logic dedup, lint gate) as future changes
