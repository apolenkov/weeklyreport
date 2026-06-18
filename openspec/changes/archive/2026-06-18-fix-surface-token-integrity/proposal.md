# Fix the undefined `--color-surface` token across the web UI

## Why

`--color-surface` is referenced in ~10 places but is **defined nowhere** in
`packages/ui/src/styles/globals.css`, so it resolves to an invalid value:

- dashed empty-state panels (`bg-[var(--color-surface)]`) render transparent
  instead of an intended surface;
- the dashboard retry CTA uses `text-[var(--color-surface)]` on a green fill, so
  its label colour is broken (a real contrast bug).

The palette already has five surface tokens (`--color-card`,
`--color-surface-empty`, `--color-surface-hover`, `--color-surface-muted`,
`--color-empty-surface`), so the fix is to drop the undefined reference and point
each callsite at the right existing token — NOT to add a sixth token.

## What Changes

- Remove every `var(--color-surface)` reference from `apps/web/src` and map each
  to the defined token for its role:
  - dashed empty-state panels → `--color-surface-empty`
  - elevated cards / tables / skeletons (border + shadow) → `--color-card`
  - the dashboard retry CTA label (text on green) → white / on-accent
- Do NOT define a new `--color-surface` token.

### Callsites (from grep `var(--color-surface)`)

- `weekly-report/weekly-report-page.tsx` (empty-submissions panel) → surface-empty
- `slides/{lead-slides-client,status-slide-deck,head-slides-client,lead-product-grid}.tsx`
  (empty dashed panels) → surface-empty
- `dashboard/lead-summary-table.tsx` (dashed empty → surface-empty; elevated card → card)
- `dashboard/dashboard-page.tsx` (elevated card → card; CTA **text** → white)
- `dashboard/dashboard-skeleton.tsx` (elevated card) → card

## Out of scope

- Any other token rename or palette change. This only removes one undefined
  reference; it is a rendering bug-fix, not theme work — authorized explicitly by
  the user (grill 2026-06-18), and consistent with the repo's "Visual And Theme
  Work" rule which gates _new_ theme directions, not fixing a broken token.
- Dark-mode overrides (theme switching stays deferred; no token added).

## Impact

- Affected specs: ADDED `surface-token-integrity` (defined-token usage by
  semantic role).
- Affected code: the eight source files listed above. CSS-class edits only; no
  logic change. Vitest snapshot files that embed the old class (e.g.
  `dashboard/__snapshots__/dashboard-skeleton.test.tsx.snap`) are refreshed by
  `vitest -u`, not hand-edited; the zero-match acceptance check excludes
  `__snapshots__`/`*.snap`.
