# Design

## Context

`mapWeeklyReport` already iterates `api.portfolioOverview`, which carries
`productId` + `productName` for every product in the report — the
authoritative name source. The groupers receive only `sections` and build a
per-section name map, which misses cross-author/secondary project
references (the seeds exercise exactly this via the W6 cross-author
overlay and SECONDARY project assignment).

## Goals / Non-Goals

**Goals:** badges never say "Unknown" for a product the report knows about.

**Non-Goals:** changing badge format, item badges (already fixed in
`apply-status-palette`), or the API read model.

## Decisions

1. **One shared map, built in `mapWeeklyReport`** from all sections'
   `projects` first, then `portfolioOverview` (overview wins on conflict —
   it is server-aggregated). Passed into `groupRisksByProject` and
   `groupDecisionsByProject` as a `ReadonlyMap<string, string>` parameter.
   Alternative — widening each grouper to scan all sections itself —
   duplicates the walk and keeps two sources of truth.
2. **Keep the `"Unknown"` literal as the genuine-miss fallback** so a truly
   foreign id stays visible instead of crashing or hiding the row.
3. **Decisions keep their `firstProject` fallback** for legacy entries
   without `productId`; only the name lookup widens.

## Risks / Trade-offs

- [Grouper signature change breaks callers] → both callers live in
  `mapWeeklyReport` + tests; typecheck catches strays.
