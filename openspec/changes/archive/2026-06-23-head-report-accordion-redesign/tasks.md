# Tasks

## 1. Tokens

- [x] 1.1 Add `--color-status-in-progress-bg` and `--color-status-in-progress-fg`
      named tokens to `apps/web/src/app/globals.css`, alongside the existing
      `--color-status-*` tokens (steel-blue family, distinct from red/amber/gold).

## 2. Presentation types

- [x] 2.1 `weekly-report-types.ts`: add REQUIRED `stage` + `owner` to
      `WeeklyReportItem`; `stage` + `owner` + `problem` + `impact` + `mitigation` to
      `WeeklyReportRisk`; `owner` to `WeeklyReportDecision`.
- [x] 2.2 `dashboard/mock-data.ts`: mirror the same fields as OPTIONAL on
      `ReportItem` / `ReportRisk` / `ReportDecision` (the component's prop types);
      leave the unused `MOCK_PRODUCT_REPORTS` fixtures untouched.

## 3. Mapper

- [x] 3.1 `groupItemsByProject`: set `stage` (from `stageIds`) and `owner` (author
      initials) on BOTH current and next items. Keep `stageLead` as-is (print).
- [x] 3.2 `groupRisksByProject`: set `stage`, `owner`, `problem`, `impact`,
      `mitigation`. Keep merged `text` + `badge` (print).
- [x] 3.3 `groupDecisionsByProject`: set `owner` (author initials). Keep `badge` +
      `text` (print).

## 4. Component

- [x] 4.1 Rewrite the `ProductAccordion` body to the uniform 5-zone grid row
      (priority | rail | gutter stage+owner | content | status badge). Keep the
      header, expand/collapse grid, highlight/scroll, Needs-Attention dedup, and
      `sortByPriority`.
- [x] 4.2 Add a status-badge helper mapping `item.status` → label + named-token
      classes (blocked / in-progress / done / planned). Items only.
- [x] 4.3 Render the priority rank in the dedicated left column (reuse the gold
      badge treatment); render structured Impact/Mitigation for risks.

## 5. Tests + gates

- [x] 5.1 Rewrite `product-accordion.test.tsx` against the new contract (uniform
      row, owner everywhere, status badge, no chip-encodes-status); regenerate
      snapshots with `-u` and eyeball the diff.
- [x] 5.2 Adjust any mapper test that asserts the old item/risk/decision shape.
- [x] 5.3 Gates green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## 6. Live verify

- [x] 6.1 Stop the stale docker `web` container; run
      `pnpm --filter @customreport/web dev`; verify `/head/report` shows the redesign
      on the real seed (text aligned, owners everywhere, correct status badges).
      Confirm next-week badges reflect the real seed status; adjust the demo seed
      only if next-week reads the wrong status.
- [x] 6.2 Capture same-viewport before/after into
      `docs/accordion-redesign-2026-06-23/`.
