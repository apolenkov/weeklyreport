# Fix Product Name Resolution

## Why

During the `apply-status-palette` acceptance (2026-06-10, archived tasks.md
5.2) risk badges on the weekly-report preview card rendered
"Unknown · <stage>" — and before-screenshots show "Unknown · Dev" predates
that change. Decision badges can show bare "Unknown" the same way. The
product NAME exists in the report; only the lookup is too narrow.

## What Changes

- `groupRisksByProject` / `groupDecisionsByProject`
  (`apps/web/src/lib/mappers/weekly-report-groupers.ts`) resolve product
  names through a report-wide projectId→productName map instead of only the
  owning section's `projects` list.
- `mapWeeklyReport` builds that map once: union of every section's
  `projects` plus `api.portfolioOverview` (which names every product in the
  report).
- "Unknown" remains only for ids genuinely absent from the entire report.
- Regression test: a risk/decision referencing a project outside its
  author's section list resolves the real name.

## Capabilities

### New Capabilities

- `report-badge-resolution`: product names on weekly-report badges resolve
  from the report-wide project map, never showing a placeholder for a
  product the report knows about.

### Modified Capabilities

<!-- none -->

## Impact

- `apps/web/src/lib/mappers/weekly-report-groupers.ts`,
  `apps/web/src/lib/mappers/weekly-report.ts` (+ their tests).
- Pure mapper change — no API/DB/UI-markup changes; badge text only.
- Risk: low; covered by mapper unit tests.
