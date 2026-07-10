## Why

The traffic-light status value has one Zod source of truth
(`trafficLightStatusSchema` in `packages/shared`) but NO exported inferred
type — so 18 source files and 6 test files across api and web hand-roll their
own `"green" | "yellow" | "red"` unions, and `analytics.ts` inside the shared
package itself re-declares the enum. Every re-declaration is a drift risk
against the Prisma enum and the wire schema.

## What Changes

- Export `type TrafficLightStatus = z.infer<typeof trafficLightStatusSchema>`
  from `packages/shared` (`report-primitives.schema.ts`, already barrel-reachable
  via `schemas/report.ts` — no index change).
- Dedupe `analytics.ts`: `trafficLightCellSchema` reuses
  `trafficLightStatusSchema.nullable()` instead of its own `z.enum`.
- Swap all 18 source re-declarations (5 api, 13 web) and 6 test-fixture
  annotations to import the shared type. Local alias NAMES survive where they
  compose (`SlideTrafficStatus = TrafficLightStatus | null`,
  `PillStatus = TrafficLightStatus | "empty"`); re-literaling the members is
  what goes away.
- Delete the duplicate `export type TrafficLightStatus` in
  `apps/api/.../published-report-snapshot.ts`; its one consumer imports from
  shared.
- Add a Prisma↔shared type-identity test (api package) and a schema
  accept/reject test (shared package).
- Update `architecture-refactor-backlog`: record the SSOT target as CLOSED
  with the corrected inventory (the "(green/amber/red)" phrasing was informal
  — "amber" occurs only as Tailwind CSS classes, never as a status value).

Non-goals:

- No DB migration (the Prisma enum already matches green/yellow/red exactly).
- No vocabulary rename, no mapper changes, no UI-string changes — pure
  type-level consolidation; runtime behavior byte-identical.
- No touch to the presentation 4-state vocabulary
  (`on-track/at-risk/blocked/empty`) — owned by `status-presentation-model`;
  its triple declaration is named as a follow-up, not bundled.
- No `TRAFFIC_RANK` / `statusSeverity` logic dedup (follow-up), no lint
  regression gate (follow-up).

## Capabilities

### New Capabilities

- `traffic-light-status-type`: Defines the shared traffic-light status type
  contract and the single-literal-home rule.

### Modified Capabilities

- `architecture-refactor-backlog`: Records the traffic-light SSOT target as
  closed with the corrected inventory.

## Impact

- `packages/shared`: `report-primitives.schema.ts` (+1 type export),
  `analytics.ts` (dedupe), one new/extended test.
- `apps/api`: 5 source files + 1 consumer swap + 1 new type-identity test.
- `apps/web`: 13 source files (including `model/traffic-light.ts`, slides
  model/ui files, period ui files) + 6 test fixture files.
- No API, database, dependency, route, or product UI behavior changes.
- Gates: `pnpm --filter @customreport/shared test`, scoped ESLint with
  `--max-warnings 0`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm format:check`, and OpenSpec validation.
