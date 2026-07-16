## Context

Two live implementations of one business rule: web `deriveEffectiveStageStatus` (CanonicalStatus, `apps/web/src/lib/stage-status.ts`) and API `deriveEffectiveProductStatus`/`deriveActivityStatus` (TrafficLight, `report-sections.status-derivation.ts`), plus a third worst-of rank copy in `published-report-snapshot.ts` (`statusSeverity`). `sweep15-status-derivation-ssot` already unified stage matching (`riskCoversStage`) and gave the API one domain fold (`aggregateTrafficLight`); this change closes the remaining recorded follow-up — the ranking/floor core itself.

## Goals / Non-Goals

**Goals:** one shared severity ladder, one worst-of fold, one risk-severity→floor mapping; web and API vocabularies become adapters; behavior byte-identical.

**Non-Goals:** semantic changes; touching stage-name matching; merging `deriveEffectiveStageStatus` and `deriveEffectiveProductStatus` into one function (their surrounding semantics — collapse-down vs aggregation-only — are legitimately different).

## Decisions

1. **`CanonicalStatus` moves to `packages/shared/src/schemas/canonical-status.ts`.** The type is pure (no React, no Prisma). Shared exports: `CanonicalStatus`, `CANONICAL_STATUS_PRECEDENCE`, `worstCanonicalStatus(values)`, `riskSeverityToCanonicalFloor(severity)` (`"blocked"` → `"blocked"`, anything else → `"at-risk"`), and the vocabulary adapters `canonicalToTrafficLight` / `trafficLightToCanonical` (traffic side: `red/yellow/green/null`, using the existing shared `TrafficLightStatus` from `report-primitives.schema.ts`).
2. **Web `status-presentation.ts` re-exports are NOT kept** — all web imports of `CanonicalStatus` are updated to `@customreport/shared`. Exemplary standard: no deprecation shims. `status-presentation.ts` keeps only presentation concerns (labels/colors) if any remain.
3. **API `aggregateTrafficLight` (domain helper) stays as the API-facing name** but its rank table delegates to the shared fold through the adapters (or is re-expressed as a one-line wrapper). `severityToTraffic` is deleted in favor of `riskSeverityToCanonicalFloor` + `canonicalToTrafficLight`.
4. **`published-report-snapshot.ts` deletes `statusSeverity`** and uses the domain `aggregateTrafficLight` helper.
5. **Collapse-down stays in `deriveEffectiveStageStatus`** — the "no backing risk ⇒ manual severity collapses to on-track" rule is documented web-only semantics (see the function's comment block); the shared core must not absorb it.
6. **Characterization first.** Before any relocation, pin current outputs of `deriveEffectiveStageStatus`, `applyRiskSeverityFloor`, `deriveEffectiveProductStatus`, `deriveActivityStatus`, and the snapshot worst-of over a permutation grid (severities: blocked/at-risk/other/undefined; explicit statuses incl. empty/null; items with/without blocked). The refactor lands only if these tests are green before AND after.

## Risks / Trade-offs

- Import-update fan-out across web consumers of `CanonicalStatus` is wide but mechanical; typecheck catches every miss.
- The `status-type-ssot-gate` lint gate bans literal-union re-declaration — moving the type to shared must ALSO update that gate's inventory if it names `status-presentation.ts` (check `eslint.config.ts` before moving).
- Watch `functional/immutable-data`: `packages/shared/src/**` is in its enforced scope; write the fold with `reduce`, no mutation.
