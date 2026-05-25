# Tasks

## Route & Layout

- **REPORT-ID-T1** — Update `apps/web/src/app/lead/report/page.tsx` to
  `[id]/page.tsx` (or add `?reportId` query param). Update the parent layout
  to pass `reportId` to child components.

- **REPORT-ID-T2** — Refactor `lead-layout.tsx` to render the report period
  or title in the breadcrumb and page title. Query the report by ID on mount
  to populate metadata.

- **REPORT-ID-T3** — Update all navigation links that point to the report
  (sidebar, quick-nav, report list) to include the `[id]` or query param.

## Verification

```bash
pnpm --filter @customreport/web typecheck
pnpm --filter @customreport/web vitest run \
  src/components/lead/lead-layout.test.tsx
pnpm --filter @customreport/web test:e2e
```
