# External review sweep — 2026-07-15

4 read-only lanes on external quotas, adjudicated by the orchestrator.
HEAD at review time: `d5642688`. Raw lane reports: session scratchpad `sweep/report-*.md`.

| Lane | Model           | Scope                                         | Grade |
| ---- | --------------- | --------------------------------------------- | ----- |
| A    | Codex (GPT-5.x) | Architecture vs exemplary-code-standard       | 6/10  |
| B    | Codex (GPT-5.x) | Product + design (specs, 5 atlas screenshots) | 7/10  |
| C    | Grok 4.5        | React/Next best practices, apps/web           | 7/10  |
| D    | Grok 4.5        | Simplification/reuse, api+web+packages        | 7/10  |

**No P0 anywhere.** Tree untouched by lanes (verified via git status).

## P1 — correctness / real UX defects (7)

1. **Stage-name normalization lives in 3 places, API read-path skips aliasing** (D)
   `packages/shared/src/schemas/stage-names.ts:40` vs local copy in
   `lead-form.prisma-repository.ts:33,858` vs raw `.includes` in
   `report-sections.status-derivation.ts:46` vs web `stage-tags.ts:101`.
   Legacy `"Dev"` can floor red in web but green in published floor. Fix: one shared
   `riskCoversStage` on `stageNamesMatch`; delete local copies; drop `"use client"` from pure helpers.

2. **`aggregateTrafficLight` duplicated write-path vs read-path** (D)
   `domain/report-section-merge.ts:14` vs `report-sections.status-derivation.ts:3`.
   Precedence tweak in one copy → silent write/read status drift. Fix: single domain helper.

3. **Global `keepPreviousData` + `isLoading`-only gates leak previous period's data** (C)
   `apps/web/src/lib/query-client.ts:44`; consumers never check `isPlaceholderData`.
   Navigating period A→B can render A's content under B's URL; mutations can target the wrong period.
   Fix: scope keepPreviousData or gate report-scoped UI/mutations on `isPlaceholderData || isFetching`.

4. **Head slides: `activity.live` failure/latency blocks the whole deck** (C)
   `head-slides-client.tsx:87-97` — activity query needed only when `leadSections.length === 0`,
   but loading/error always wait on it. Viewer path already avoids this. Fix: condition the gate.

5. **Production weekly-report UI typed against parallel mock-data model** (A+D, same root)
   `dashboard-mock-data.ts` / `admin-mock-data.ts` own `ProductReport`/`PortfolioProduct`/`MockUser`
   types consumed by live UI (`print-report-template.tsx:15`, `product-accordion.tsx:10`,
   `users-tab.tsx:10`), while canonical `Weekly*` types exist in `weekly-report-types.ts`.
   Mock arrays themselves are dead exports. Fix: move types to feature models, retype consumers,
   delete dead `MOCK_*`, mocks satisfy live types.

6. **Head dashboard: draft rows with content are not clickable** (B)
   `activity-live-panel.tsx:175` — link only when `hasContent && !isDraft`; drafts (the rows the
   head must inspect pre-deadline) render as inert divs. Fix: link every content-bearing row.

7. **Slide product status is color-only** (B, a11y; spec-mandated at
   `lead-slide-by-product-grid/spec.md:103`) — stripe+dot with no text/shape; fails CVD users and
   projection. Fix: compact status word/icon next to product name. NB: this is a spec change, not drift.

## Product forks — Саша decides (both are documented deferrals, not bugs)

- **Viewer authority model** (B): viewers read the live draft period, but search covers published
  only — two truth windows (`viewer-report-navigation/spec.md:71` vs `viewer-published-search/spec.md:11`).
  Options: published-only stakeholder mode / labeled operational-observer mode / dual search scope.
- **Activity escalation parity** (B): activity-parented blocked/at-risk records are skipped in
  `report-escalations.ts:54-65` (deliberate Phase-1 asymmetry per `status-risk-unification/spec.md:142`).
  Reopening means an activity-scoped escalation type on the head dashboard.

## P2 — worthwhile, batched by theme

**Architecture (A):** application layer imports Prometheus/BullMQ/Prisma directly (6 modules);
`queryPublishedLineage` inverted layering (`application/` ↔ infrastructure); tRPC adapter imports
~20 module-internal files bypassing barrels (`trpc.router.ts:4-23`, ratchet doesn't cover
infra→module); `PeriodStatus` union redeclared in 3 web modules; `mapWeeklyReport` 90-line mutable
dual-projection; print template 766-line exempt file (also D's `section-slide-utils.ts` god module).

**React/perf (C):** AdminPanel fetches snapshot+settings on every tab; dashboard panels gated
behind dual-query barrier; missing `optimizePackageImports` for lucide-react/recharts; trends
`dynamic()` through feature barrel weakens code-split; render-blocking Google Fonts (TODO exists);
page-level Suspense doesn't actually stream tRPC data.

**Simplify (D):** `AdminService` pure pass-through facade; optional `AdminRepository` methods with
silent `[]` fallbacks; `TRAFFIC_RANK`/worst-of copy-pasted in 5 places; pass-through date-helper
wrappers; two bespoke confirm dialogs beside `ConfirmationDialog`; three divergent relative-time
formatters.

**Product/UX (B):** head dashboard = 3 repeated lead rosters, no single action queue; lead form
lacks sticky Save/Submit + readiness summary near the end; admin Delete pill sits beside routine
actions (34px targets); slides too dense for projection; viewer "Live · 3/8 Submitted" authority
signals unclear; spec directory has TBD purposes and mixes product with engineering governance;
ui-atlas gaps concentrate exactly on review/reopen/risk-lock flows.

## Not-issues confirmed by lanes (don't re-report)

Domain purity holds; only type-only `AppRouter` crosses web→api; feature barrels respected;
`roleSchema`/`sessionRoleSchema` intentional; CAS siblings not dupes; production `let` only behind
justified disables; viewer shell mutation-safe; PDF export real except lead ComingSoon;
`reactCompiler: true` makes memo-sweeps unnecessary; dashboard's two root queries already parallel.
