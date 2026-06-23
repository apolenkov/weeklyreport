# Code-Health Map

A ranked, reproducible register of the codebase's maintainability debt. It is the
single home of the evidence behind `architecture-refactor-backlog`. Generated
by the OpenSpec change `code-health-audit-map`.

## ⚠ This map is NOT authorization to refactor

- **Each entry requires its own grilled OpenSpec change**, with a
  **characterization test written first**, per `code-quality-modernization`,
  before any code changes.
- **The entries MUST NOT be executed as a batch or in parallel.** A blind
  metric-driven sweep over this list is the exact pattern that previously passed
  the gate but broke behavior (the "parallel-army refactor"). This list is a
  prioritized set of candidates, never a task queue.
- **Map-entry Definition of Done** (what makes a row complete here) = evidence
  gathered + verdict recorded + rank assigned. This is distinct from the
  **refactor Definition of Done** (the module honestly meeting the 300-line /
  complexity-20 / cognitive-15 standard _without_ an exemption), which stays
  open until a future grilled change lands it.

## Staleness stamp

| Field                 | Value         |
| --------------------- | ------------- |
| Commit                | `f7cb2c56`    |
| Date                  | 2026-06-22    |
| node                  | v26.3.1       |
| eslint                | v10.5.0       |
| eslint-plugin-sonarjs | 4.1.0         |
| typescript-eslint     | 8.61.1        |
| git                   | 2.50.1        |
| Churn window          | last 6 months |

Stale numbers here are evidence to **regenerate**, not current fact. The four
legacy `architecture-refactor-backlog` requirements' inline numbers are
superseded by this register.

## How to regenerate

All numbers trace to these commands (run from the repo root):

- **code-LOC + peak cyclomatic + peak cognitive** — a throwaway flat ESLint
  config enabling `max-lines:1`, `complexity:1`, `sonarjs/cognitive-complexity:1`
  with the `typescript-eslint` parser + `ecmaFeatures.jsx`, run with
  `--no-inline-config --no-config-lookup` (the `--no-inline-config` is required
  so in-source `eslint-disable` comments do not hide the real numbers). Each
  rule message reports the measured value ("too many lines (N)", "complexity of
  N", "from N to the 1 allowed"); take the per-file maximum. Config must live at
  the repo root (plugin resolution).
- **churn** — `git log --follow --since="6 months ago" --format= --name-only -- <path> | grep -c .` (per file; `--follow` keeps history across slice renames).
- **risk-zone** — path match against the HOT ZONE list from
  `code-quality-modernization` (product / group / report-period /
  query-semantics / `report-sections`) plus authz paths.

## Hotspot ranking model

`score = (codeLOC/300 + peakCognitive/15) × churn × riskWeight`

Divisors are **absolute and pinned** (the repo's own 300-line and 15-cognitive
standards), so a file's score does not move when the candidate set changes — the
rank reproduces at a later commit. `riskWeight`: HOT = 2.0, MID = 1.3, LOW = 1.0.
Rank is never by file size alone — e.g. `trpc.router.ts` is physically the
largest file yet ranks #2 behind the smaller-but-hotter `lead-form.tsx`.

## Coverage dimensions (ISO/IEC 25010 maintainability, as a taxonomy only)

| Dimension                         | ISO 25010 sub-characteristic | Status in this map                                          |
| --------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| Size (code-LOC)                   | analysability                | measured                                                    |
| Cyclomatic + cognitive complexity | modifiability                | measured                                                    |
| Hotspot (× churn × risk)          | modifiability                | measured                                                    |
| Structural / grouping             | modularity                   | bounded read pass (below)                                   |
| Dead code / unused exports        | analysability                | **DEFERRED** (needs knip; no dep added here)                |
| Logic duplication                 | reusability                  | **DEFERRED** (needs jscpd; no dep added here)               |
| Testability                       | testability                  | governed by the characterization-test rule, not re-measured |

The two DEFERRED dimensions are in scope but require tooling not yet installed;
they are deferred to a dedicated follow-up change (to be created) so the gap is
visible, not silent.

## OBSOLETE exemptions — actionable cleanup (verified this commit)

These per-file exemptions in `eslint.config.ts` are **no longer needed** — the
file now meets the standard on that dimension. Removing the line restores real
gate coverage. (Each removal should still be its own small verified change.)

| File                                                                  | Exemption to remove                                 | Current vs standard                                                                 |
| --------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/web/src/app/print/[reportId]/page.tsx`                          | `max-lines`                                         | 30 LOC ≪ 300 (stale; the big template was extracted to `print-report-template.tsx`) |
| `apps/web/src/components/lead/decision-edit-dialog.tsx`               | `max-lines`                                         | 255 LOC < 300 (keep its `complexity` exemption: cx 30)                              |
| `apps/web/src/app/login-page.client.tsx`                              | `complexity` **and** `sonarjs/cognitive-complexity` | cx 15 ≤ 20, cc 15 ≤ 15 (both obsolete)                                              |
| `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` | `sonarjs/cognitive-complexity`                      | cc 14 ≤ 15 (keep its `max-lines`: 462 LOC)                                          |
| `apps/web/src/components/lead/lead-form-sync-bridge.tsx`              | `sonarjs/cognitive-complexity`                      | cc 14 ≤ 15 (keep its `max-lines`: 372 LOC)                                          |
| `apps/web/src/components/lead/next-week-section.tsx`                  | `sonarjs/cognitive-complexity`                      | cc 15 ≤ 15 (keep its `complexity`: cx 23)                                           |
| `apps/web/src/components/lead/sdlc-pipeline.tsx`                      | `sonarjs/no-nested-functions`                       | 0 firings (the nesting is gone)                                                     |

## Ranked hotspot register

Verdict legend: **CONFIRMED** = exemption holds, cohesive single concern, leave
it; **CONTESTED** = a split boundary is identifiable and worth a future grilled
change; **OBSOLETE** = an exemption on this file is now removable (see table
above). LOC = code-LOC; cc = peak cognitive; cx = peak cyclomatic; chn = churn.

| #   | Score | File                                                                        | LOC  | cc  | cx  | chn | Zone | Verdict                                                                                  |
| --- | ----- | --------------------------------------------------------------------------- | ---- | --- | --- | --- | ---- | ---------------------------------------------------------------------------------------- |
| 1   | 2664  | `apps/web/src/components/lead/lead-form.tsx`                                | 1322 | 55  | 106 | 165 | HOT  | CONTESTED — decomposition target; `refactor-lead-mappers` slice landed, more slices owed |
| 2   | 1424  | `apps/api/src/infrastructure/trpc/trpc.router.ts`                           | 1715 | 20  | 13  | 101 | HOT  | CONTESTED — extract per-namespace service layer (not a shell split)                      |
| 3   | 213   | `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts`       | 462  | 14  | 10  | 43  | HOT  | CONFIRMED (cognitive exemption now OBSOLETE)                                             |
| 4   | 196   | `apps/api/src/infrastructure/trpc/trpc.middleware.ts`                       | 353  | 22  | 20  | 37  | HOT  | CONFIRMED — one request-lifecycle closure                                                |
| 5   | 173   | `apps/web/src/components/weekly-report/weekly-report-page.tsx`              | 438  | 15  | 35  | 54  | MID  | CONTESTED — split data-load vs render/mutations                                          |
| 6   | 167   | `apps/web/src/lib/mappers/lead-form.ts`                                     | 402  | 9   | 8   | 43  | HOT  | CONFIRMED — one mapping pipeline (further split fragments it)                            |
| 7   | 147   | `apps/web/src/components/slides/section-slide-utils.ts`                     | 952  | 23  | 27  | 24  | MID  | CONTESTED — extract the non-core mappers (core ~247 lines stays)                         |
| 8   | 143   | `apps/web/src/components/lead/lead-form-sync-bridge.tsx`                    | 372  | 14  | 13  | 33  | HOT  | CONFIRMED (cognitive exemption now OBSOLETE)                                             |
| 9   | 135   | `apps/web/src/components/navigation/nav-bar.tsx`                            | 405  | 14  | 21  | 59  | LOW  | CONFIRMED — one role-aware nav widget                                                    |
| 10  | 128   | `apps/api/src/modules/auth/auth.routes.ts`                                  | 363  | 10  | 26  | 34  | HOT  | CONFIRMED — load-bearing mount order                                                     |
| 11  | 126   | `apps/web/src/components/lead/risks-section.tsx`                            | 297  | 16  | 26  | 47  | MID  | CONFIRMED — prior split broke behavior                                                   |
| 12  | 122   | `apps/web/src/components/slides/status-slide-deck.tsx`                      | 601  | 22  | 19  | 27  | MID  | CONTESTED — lead/head modes separable                                                    |
| 13  | 112   | `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` | 439  | 13  | 10  | 24  | HOT  | CONFIRMED — coupled include/type/mapper                                                  |
| 14  | 111   | `apps/web/src/components/lead/risk-edit-dialog.tsx`                         | 412  | 13  | 32  | 38  | MID  | CONFIRMED — one dialog, validation-coupled                                               |
| 15  | 96    | `apps/api/src/modules/admin/period-admin.service.ts`                        | 347  | 17  | 20  | 21  | HOT  | CONFIRMED — one period-lifecycle service                                                 |
| 16  | 92    | `apps/web/src/app/login-page.client.tsx`                                    | 276  | 15  | 15  | 48  | LOW  | OBSOLETE — both exemptions removable                                                     |
| 17  | 87    | `apps/web/src/components/slides/lead-slides-client.tsx`                     | 309  | 14  | 38  | 34  | MID  | CONFIRMED — deck lifecycle (uses inline disable; see structural)                         |
| 18  | 83    | `apps/web/src/components/admin/users-tab.tsx`                               | 558  | 9   | 14  | 26  | MID  | CONFIRMED — one CRUD panel                                                               |
| 19  | 80    | `apps/web/src/components/lead/stage-chip.tsx`                               | 245  | 26  | 32  | 24  | MID  | CONFIRMED — entangled chip interactions                                                  |
| 20  | 79    | `apps/web/src/components/lead/sdlc-pipeline.tsx`                            | 285  | 7   | 15  | 43  | MID  | OBSOLETE — no-nested-functions exemption removable                                       |
| 21  | 74    | `apps/web/src/components/lead/next-week-section.tsx`                        | 247  | 15  | 23  | 31  | MID  | CONFIRMED (cognitive exemption now OBSOLETE)                                             |
| 22  | 71    | `apps/web/src/components/weekly-report/product-accordion.tsx`               | 373  | 17  | 31  | 23  | MID  | CONFIRMED — uniform accordion pattern                                                    |
| 23  | 69    | `apps/web/src/components/admin/products-tab.tsx`                            | 479  | 8   | 13  | 25  | MID  | CONFIRMED — one CRUD screen                                                              |
| 24  | 68    | `apps/web/src/app/(app)/reports/page.tsx`                                   | 237  | 24  | 24  | 22  | MID  | CONFIRMED — 5-role renderer                                                              |
| 25  | 64    | `apps/web/src/components/lead/item-edit-dialog.tsx`                         | 343  | 13  | 32  | 32  | LOW  | CONFIRMED — interdependent form state                                                    |
| 26  | 63    | `apps/web/src/components/dashboard/dashboard-page.tsx`                      | 355  | 10  | 23  | 34  | LOW  | CONFIRMED — orchestrator, hook-coupled                                                   |
| 27  | 63    | `apps/web/src/app/print/[reportId]/print-report-template.tsx`               | 666  | 6   | 8   | 24  | LOW  | CONFIRMED — one A4 print layout                                                          |
| 28  | 45    | `apps/web/src/components/lead/decision-edit-dialog.tsx`                     | 255  | 9   | 30  | 31  | LOW  | OBSOLETE — max-lines removable (keep complexity)                                         |
| 29  | 44    | `apps/web/src/components/admin/groups-tab.tsx`                              | 455  | 7   | 14  | 17  | MID  | CONFIRMED — one CRUD tab                                                                 |
| 30  | 39    | `apps/web/src/components/lead/lead-history-sidebar.tsx`                     | 191  | 28  | 24  | 12  | MID  | CONFIRMED — multi-branch status messaging                                                |
| 31  | 30    | `apps/api/src/modules/analytics/analytics.prisma-repository.ts`             | 172  | 16  | 8   | 9   | HOT  | CONFIRMED — 3-level matrix traversal                                                     |
| 32  | 26    | `apps/web/src/hooks/use-status-risk.ts`                                     | 126  | 13  | 8   | 10  | HOT  | CONFIRMED — consolidated to avoid loops                                                  |
| 33  | 25    | `apps/web/src/components/admin/admin-panel.tsx`                             | 124  | 4   | 24  | 28  | MID  | CONFIRMED — 9-tab dispatch                                                               |
| 34  | 16    | `apps/web/src/components/slides/head-slides-client.tsx`                     | 128  | 10  | 21  | 11  | MID  | CONFIRMED — guard clauses + slide build                                                  |
| 35  | 11    | `apps/web/src/components/dashboard/remind-lead-button.tsx`                  | 116  | 28  | 16  | 5   | LOW  | CONFIRMED — one ConfirmState machine                                                     |
| 36  | 8     | `apps/web/src/app/print/[reportId]/page.tsx`                                | 30   | 3   | 5   | 25  | LOW  | OBSOLETE — max-lines exemption is stale                                                  |
| 37  | 7     | `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`                | 229  | 16  | 10  | 2   | HOT  | CONFIRMED — role-aware upsert + FK guard                                                 |
| 38  | 4     | `apps/web/src/lib/trpc.ts`                                                  | 67   | 4   | 8   | 9   | LOW  | CONFIRMED — RxJS error-link handlers                                                     |
| 39  | 2     | `apps/api/src/modules/admin/admin-settings.queries.ts`                      | 112  | 18  | 19  | 1   | MID  | CONFIRMED — schema-width, not branching                                                  |
| 40  | 1     | `apps/web/src/components/landing/tagline-cycler.tsx`                        | 36   | 0   | 2   | 9   | LOW  | CONFIRMED — self-recursive timer handler                                                 |

### Data / generated / tooling (excluded from ranking — no logic to refactor)

`dashboard/mock-data.ts` (820), `lead/mock-data.ts` (747), `admin/mock-data.ts`
(447), `packages/ui/.../sidebar.tsx` (667, shadcn-generated),
`prisma/wipe-manual-uat.ts` (503, one-off script), `shared/.../report.schema.ts`
(321, Zod catalogue), `apps/api/src/main.ts` (316, bootstrap),
`web/uat-suite/inventory.mjs` (221, tooling).

## Architectural targets (non-size) — refreshed

These are the existing `architecture-refactor-backlog` targets that are not size
exemptions. Verdict = STILL-PRESENT / RESOLVED.

| Target                            | Refreshed evidence (this commit)                                                                                                                  | Verdict                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Scattered client permission model | ~16 web files contain inline role checks (`role ===` / `=== "head"\|"lead"\|"viewer"\|"admin"`)                                                   | STILL-PRESENT — centralization target stands                                                                                             |
| Traffic-light re-typing           | A canonical `TrafficLightStatus` now exists in `packages/shared` (used in ~22 sites); but ~12 files still reference the raw `amber` color literal | PARTIALLY RESOLVED — canonical type exists; verify the 12 literal sites are presentational (CSS) vs domain re-typing before further work |
| Repository Prisma-type leak       | 16 `*.prisma-repository.ts` files form the boundary surface (see `repository-scope-guard`)                                                        | STILL-PRESENT — boundary-mapping target stands                                                                                           |

The prior spec's "~33 files" traffic-light figure is **stale** — that was the
value this refresh exists to correct.

## Structural / grouping findings (bounded read pass)

Scoped to the ranked shortlist + the `components/` root, not all ~730 files.

1. **Loose files at `apps/web/src/components/` root** (no feature folder):
   `error-boundary.tsx`, `forbidden-page.tsx`, `role-gate.tsx`,
   `web-vitals-reporter.tsx`, `agentation-devtools.tsx`. Convention is
   feature/domain folders. `forbidden-page` + `role-gate` are access-control
   and could live under a `common/` (which exists) or an `access/` folder.
   Low-risk grouping cleanup.
2. **Inline `eslint-disable max-lines` instead of the config block.**
   `print-report-template.tsx` and `lead-slides-client.tsx` carry their size
   exemption as an in-source comment, inconsistent with the documented
   config-block convention (and invisible to the config's exemption list — this
   map only found them via `--no-inline-config`). Consider moving them to the
   config block for one discoverable source of exemptions.

Overall: the macro structure (web feature-folders, NestJS module-per-domain,
`packages/shared` + `packages/ui`) is conventional and sound. No domain-grouping
chaos was found — the maintainability debt is concentration in a few hot files,
not disorganization.
