## Context

`buildSectionSlideModel` builds `SectionProductProjection` before readiness.
Each real `productSlide.status` is already the worst status of its stages after
`floorSlideStageStatus` applies the unified risk derivation. Readiness instead
re-reads persisted `section.projects[].trafficLight`, so one model can produce a
green badge and a blocked section.

## Goals / Non-Goals

**Goals:**

- Make readiness project counts consume the same derived statuses as product
  badges.
- Preserve the current project-plus-risk-row counting contract and readiness
  copy.

**Non-Goals:**

- No API, shared-schema, merge, persistence, migration, or backfill change.
- No change to traffic-light completeness, cross-product readiness, or foreign
  health.

## Decisions

### Reuse the completed projection

Pass `SectionProductProjection` to `statusCounts` and count red/yellow real
product slides. Restrict the count to ids present in `section.projects`, so the
optional synthetic cross-product slide cannot become a project count.

This reuses `buildProductSlide`'s existing
`floorSlideStageStatus` → `deriveEffectiveStageStatus` →
`worstTrafficStatus` path. Re-deriving from raw stages inside readiness was
rejected because it would create a second implementation that could drift from
the badge again. Reading `project.trafficLight` with a local exception was
rejected because the persisted value is the stale source.

The existing project-scoped blocked/at-risk risk-row counts remain additive.
Therefore one risk-backed red product with one blocked risk contributes two to
`blockedCount`: one derived product signal and one risk-row signal, matching
current aggregation semantics.

### Keep completeness separate

`hasProjectStatuses` continues to inspect persisted project traffic lights.
That check answers whether every product has saved input, not what severity the
slide displays; changing it would broaden this fix into submit/completeness
semantics.

## Risks / Trade-offs

- [A future projection adds another synthetic product] → Count only ids backed
  by `section.projects` and cover the boundary in the regression test.
- [Persisted and derived values remain different] → Accepted here; the unified
  presentation model intentionally collapses stale severity. Write-path cleanup
  requires a separate change.

## Migration Plan

Ship as a web-only read-model correction with no data migration or feature
flag. Rollback is the single readiness derivation change. Period dual-state,
role-coverage, destructive-database, and deferred-feature invariants are
unaffected.

## Open Questions

None.
