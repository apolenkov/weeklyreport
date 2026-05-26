# Tasks

## Route & Layout

- [x] REPORT-ID-T1: Update `apps/web/src/app/lead/report/page.tsx` to
      `[id]/page.tsx` (or add `?reportId` query param). Update the parent
      layout to pass `reportId` to child components.
      (ALREADY DONE — Phase 35-07: `/lead/report/[reportId]/page.tsx` exists;
      bare `/lead/report` redirects via redirectToCanonical prop)
- [x] REPORT-ID-T2: Refactor `lead-layout.tsx` to render the report period
      or title in the breadcrumb and page title. Query the report by ID on
      mount to populate metadata.
      (ALREADY DONE — LeadForm receives reportId prop, handles display)
- [x] REPORT-ID-T3: Update all navigation links that point to the report
      (sidebar, quick-nav, report list) to include the `[id]` or query
      param. (ALREADY DONE — links use reportId from route params)

## Verification

```bash
pnpm --filter @customreport/web typecheck
pnpm --filter @customreport/web vitest run \
  src/components/lead/lead-layout.test.tsx
pnpm --filter @customreport/web test:e2e
```
