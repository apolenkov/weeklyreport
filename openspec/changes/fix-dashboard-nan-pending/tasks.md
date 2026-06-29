# Tasks: fix-dashboard-nan-pending

## web

- [ ] **Guard submission ratio in `KpiCards`**
      File: `apps/web/src/components/dashboard/kpi-cards.tsx`
      Replace line 10:

  ```ts
  const submissionPercent = Math.round((data.submitted / data.total) * 100);
  ```

  with:

  ```ts
  const submissionPercent =
    data.total > 0 ? Math.round((data.submitted / data.total) * 100) : 0;
  ```

  No other lines change.

- [ ] **Drop the `isDraft` heuristic in `AlertBar`**
      File: `apps/web/src/components/dashboard/alert-bar.tsx`
      Replace the `pendingNames` mapping block (lines 90–99) with a version that
      labels every entry "Not started":
  ```tsx
  const pendingNames = pendingLeads.map((name, i) => {
    const isLast = i === pendingLeads.length - 1;
    return (
      <span key={name}>
        <strong>{name}</strong> (Not started)
        {!isLast && " and "}
      </span>
    );
  });
  ```
  The `isDraft` variable and the ternary `isDraft ? "Draft" : "Not started"`
  are removed entirely.

## tests

- [ ] **Add zero-total regression case to `KpiCards` tests**
      File: `apps/web/src/components/dashboard/kpi-cards.test.tsx`
      Add a `describe` block (or `it`) that renders `KpiCards` with
      `{ submitted: 0, total: 0, ... }` and asserts:

  - the Submissions `region` aria-label contains `"0 of 0, 0 pending"`, never
    `"NaN"`
  - the conic ring `title` attribute is
    `"0 of 0 leads submitted this week (0%)"` and contains no `"NaN"`
  - the conic ring's inline `background` style contains the `0%`
    conic-gradient stops (e.g. `0% 0%`) and contains no `"NaN"`
  - no element's text content includes `"NaN"`

- [ ] **Add label accuracy case to `AlertBar` tests**
      File: `apps/web/src/components/dashboard/alert-bar.test.tsx`
      Add a case that renders `AlertBar` with two entries in `pendingLeads` and
      `reopenCount` mock returning `0`, then asserts:

  - both names appear in the document
  - the text "Not started" appears for each entry
  - the text "Draft" does not appear anywhere in the rendered output

- [ ] **Refresh the stale `AlertBar` snapshot**
      File:
      `apps/web/src/components/dashboard/__snapshots__/alert-bar.test.tsx.snap`
      The existing snapshot asserts the first pending lead is labeled `Draft`
      (the `Draft` token sits in the committed `.snap`). The label change makes
      that snapshot fail, so the snapshot gate goes red unless it is updated.
      Re-record it (`pnpm --filter @customreport/web exec vitest run -u
    alert-bar`) and confirm the regenerated snapshot contains `Not started`
      for every entry and no `Draft` token before committing.

## verification

- [ ] **Run quality gates**
  ```
  pnpm typecheck && pnpm lint && pnpm test && pnpm build
  ```
  All gates must exit 0 before the change is considered done.
