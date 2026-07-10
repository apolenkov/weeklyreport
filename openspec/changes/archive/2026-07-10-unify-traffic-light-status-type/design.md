## Context

`packages/shared/src/schemas/report-primitives.schema.ts` defines
`trafficLightStatusSchema = z.enum(["green", "yellow", "red"])` — already the
wire contract for report/section schemas, already matching the Prisma enum
`TrafficLightStatus { green yellow red }` (prisma/schema.prisma) — but exports
no inferred TypeScript type. With nothing to import, 18 source files re-typed
the union locally (5 api, 13 web), 6 test files annotate fixtures with it, and
`packages/shared/src/schemas/analytics.ts` re-declares the enum inside the
SSOT package itself.

This change was council-grilled by two seats (deep-reasoning adviser + Codex),
both verifying independently. Consensus: the backlog's "(green/amber/red)"
phrasing is informal — every `amber` occurrence in the repo is a Tailwind CSS
class or a comment, never a status value; the DB enum matches, so this is a
pure type-level consolidation with zero runtime delta. The one factual
disagreement (whether the schema is barrel-reachable) was adjudicated against
the code: `schemas/report.ts:9` re-exports `report-primitives.schema` and
`index.ts:12` re-exports `schemas/report` — reachable, no index edit needed.

Load-bearing invariants:

- Wire/DB compatibility: schema values and Prisma enum unchanged; payloads and
  stored values byte-identical.
- `status-presentation-model` boundary: the presentation vocabulary
  (`on-track/at-risk/blocked/empty`) and its normalizers are NOT touched.
- `at_risk` escalation type (stage-less flagged-red roll-up in
  dashboard-escalations) is string-keyed and unrelated — excluded explicitly.

## Goals / Non-Goals

**Goals:**

- One home for the `"green" | "yellow" | "red"` literals:
  `report-primitives.schema.ts`. Everywhere else composes the exported
  `TrafficLightStatus`.
- Dedupe the shared-internal `analytics.ts` enum.
- Pin the contract: schema accept/reject test (shared) and a Prisma↔shared
  type-identity test (api — shared must not import Prisma).
- Close the backlog target with corrected inventory.

**Non-Goals:**

- No DB migration, vocabulary rename, mapper change, or UI-string change.
- No presentation-vocabulary consolidation (`StageStatus`/`CanonicalStatus`
  triple declaration → named follow-up under `status-presentation-model`).
- No `TRAFFIC_RANK`/`statusSeverity` logic dedup (follow-up).
- No lint regression gate in this change (follow-up; an AST selector for
  literal unions is fiddly and the test files must be covered too).

## Decisions

### D1: `z.infer` type beside the schema, no barrel edit

`export type TrafficLightStatus = z.infer<typeof trafficLightStatusSchema>`
lands next to the schema, matching the package's `xxxSchema`/`Xxx` convention
and the Prisma enum name. The existing barrel chain already exposes it.

### D2: Compose, don't re-literal

The enforced rule: the three literals may appear only in
`report-primitives.schema.ts`; every other site imports the type and may
COMPOSE it (`| null` for "no data", `| "empty"` for the pill presentation
variant, `Record<TrafficLightStatus, X>` for maps). Local alias names survive
where composition gives them meaning (`SlideTrafficStatus`,
`StageTrafficStatus`, `StageStatusValue`, `PillStatus`) so their consumers
stay untouched.

Alternative rejected: renaming every alias to the shared name — churns
consumers for zero drift-risk reduction.

### D3: `ActivityAlarmFloor` stays as-is

`lib/activity-alarm.ts`'s `"yellow" | "red" | null` is a deliberate SUBSET
(green excluded). Rewriting it as `Exclude<TrafficLightStatus, "green"> | null`
asserts a design claim beyond this mechanical change; it stays, noted here so
the "single literal home" rule is read as "single home for the FULL union".

### D4: `traffic-light.ts` keeps its mappers and self-containment

The module's header rationale (no imports from UI modules) survives —
`@customreport/shared` is the canonical dependency, not a UI module. Only its
local `TrafficLightStatus` alias becomes an import; `StageStatus` and both
normalizer functions are presentation-model territory and stay verbatim.

### D5: The api's duplicate exported type dies

`published-report-snapshot.ts`'s `export type TrafficLightStatus` (the second
exported type of that name in the workspace) is deleted; its one external
consumer (`weekly-report-portfolio.ts`) imports from shared — the only
cross-file import swap in the change.

## Risks / Trade-offs

- Amber trap -> "amber" is a CSS color token in class names
  (`bg-amber-100`, …) and one unrelated local tone union in
  `periods-tab-table.tsx` (submission-progress ratio, not traffic light). Do
  not touch ANY `amber` string; no rename exists in this change.
- Silent narrowing (dropping `| null` / `| "empty"` in a swap) ->
  `pnpm typecheck` catches every narrowing; each site keeps its suffix
  verbatim; `traffic-light.test.ts` pins mapper null handling.
- Shared/analytics dedupe changes parse behavior -> `.nullable()` preserved;
  `analytics.test.ts` + `report.test.ts` pin accept/reject; no import cycle
  (both files import only zod).
- Careless search-replace hits `at_risk` escalation strings -> excluded
  explicitly; the codemod is type-position-only.
- Test-fixture churn reads as behavior change -> 6 test files change import
  lines only; called out for review.

## Migration Plan

1. Shared: add the type export; dedupe `analytics.ts`; add/extend the schema
   accept/reject test. Gate: `pnpm --filter @customreport/shared test`.
2. Api: swap 5 source files, delete the duplicate exported type, swap its
   consumer; add the Prisma↔shared identity test
   (`expectTypeOf<TrafficLightStatus>().toEqualTypeOf<$Enums.TrafficLightStatus>()`).
3. Web: swap 13 source files (aliases become compositions per D2).
4. Tests: swap the 6 fixture files.
5. Verify: repo grep for the literal union outside
   `report-primitives.schema.ts` returns only justified hits (D3); full gates.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
