# Tasks

- [x] 1. Replace `bg-[var(--color-surface)]` on dashed empty-state panels with
     `bg-[var(--color-surface-empty)]`: `weekly-report/weekly-report-page.tsx`,
     `slides/{lead-slides-client,status-slide-deck,head-slides-client,lead-product-grid}.tsx`,
     and the dashed empty branch of `dashboard/lead-summary-table.tsx`.
- [x] 2. Replace `bg-[var(--color-surface)]` on elevated cards/tables/skeletons
     with `bg-[var(--color-card)]`: `dashboard/lead-summary-table.tsx` (solid
     card), `dashboard/dashboard-page.tsx` (card), `dashboard/dashboard-skeleton.tsx`.
- [x] 3. Fix `dashboard/dashboard-page.tsx` retry CTA: `text-[var(--color-surface)]`
     → `text-white` (light on-accent) so the label has AA contrast on the green
     fill.
- [x] 4. Grep `var(--color-surface)` across NON-snapshot source in `apps/web/src`
     - `packages/ui/src` (exclude `**/__snapshots__/**`, `*.snap`): zero matches.
       Then refresh affected Vitest snapshots (`vitest -u`) so files like
       `dashboard/__snapshots__/dashboard-skeleton.test.tsx.snap` (which currently
       embed `bg-[var(--color-surface)]`) pick up the new token and don't go red.
       Do NOT add a `--color-surface` token to `globals.css`.
- [x] 5. Gates green (typecheck/lint/test, incl. updated snapshots). Live
     spot-check: an empty-state panel (e.g. head period with no submissions) shows
     a surface-empty background, and the dashboard retry CTA label is readable
     white on green.
