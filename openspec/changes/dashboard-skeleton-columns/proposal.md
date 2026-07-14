## Why

BL-20 (P1), `docs/reviews/repo-excellence-review-2026-07-14.md`,
dashboard-skeleton sub-finding only. BL-20 bundles two unrelated web-state
bugs (admin products-tab re-expand, dashboard skeleton column widths) with
no shared seam — this change covers the dashboard-skeleton half only; the
admin products-tab half is `admin-products-tab-state`.

`DashboardSkeleton`
(`apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx`) builds each
column-width class with a dynamic template literal,
`` `h-3 w-[${w}px]` ``. Tailwind v4's static JIT scanner extracts utility
classes by matching literal patterns in source text — it cannot evaluate a
runtime template-literal interpolation, so `w-[${w}px]` is never generated
as a real CSS class. No width utility exists in the built stylesheet for
these bars, so every header skeleton bar collapses to zero width, visible on
every head-dashboard loading state.

## What Changes

- `dashboard-skeleton.tsx`: replace the dynamic `w-[${w}px]` template
  literal with either (a) a static lookup map from the known discrete width
  values to literal Tailwind class strings (e.g. `{120: 'w-[120px]', 160:
'w-[160px]', ...}`, so each class string appears verbatim in source for
  the JIT scanner to find), or (b) an inline `style={{ width: w }}` if the
  width set isn't a small fixed enum — pick (a) if the current widths are a
  small closed set (verify during implementation), else (b).

## Claim disposition

| Sub-claim                                                                                | Disposition | Notes                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Dynamic template-literal Tailwind class never gets JIT-extracted, bars render zero width | Confirmed   | Tailwind v4's static scanner requires literal class strings in source; a runtime-interpolated `w-[${w}px]` cannot be statically extracted. |

No refuted sub-claims — no preservation-test task required.

## Non-goals

- No change to the skeleton's overall layout, animation, or which columns
  render skeleton bars — only how each bar's width is expressed in markup.
- No broader repo-wide sweep for other dynamic-Tailwind-class instances —
  this change fixes the one confirmed instance in
  `dashboard-skeleton.tsx`; a repo-wide sweep is out of scope (flag as a
  follow-up if a grep during implementation turns up siblings, don't expand
  this change's blast radius silently).
- Admin products-tab re-expand (the other BL-20 sub-finding) — tracked
  separately as `admin-products-tab-state`; no shared file, no shared seam.

## File manifest

- `apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx` (source, verified present, 124 lines)
- `apps/web/src/features/dashboard/ui/dashboard-skeleton.test.tsx` (test, verified present)
- `apps/web/src/features/dashboard/ui/__snapshots__/dashboard-skeleton.test.tsx.snap` (snapshot, verified present — a static-class-vs-inline-style change will likely need `vitest -u` to refresh this; review the diff, don't blind-accept)

## Verification

- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- Unit test: render `DashboardSkeleton` and assert each bar's rendered
  `className` (or inline `style.width`) is not empty/zero and matches the
  intended width value — a jsdom-level assertion that the class string (or
  style attribute) is present is sufficient to catch a regression back to
  a dynamic template literal.
- Whether the fix actually produces visible width depends on Tailwind's
  build-time JIT extraction, which a unit test cannot observe (jsdom has no
  real stylesheet). Manual/Playwright drive step required in addition to
  unit tests:
  1. Build/run the app from source (not the stale docker image — see
     CLAUDE.md's live-verify guidance) so the current Tailwind build is in
     effect.
  2. Load the head dashboard in a loading state (throttle the network or
     use a dev inspector to freeze on the skeleton).
  3. Confirm each header skeleton bar renders with visible non-zero width,
     not collapsed to a thin line.

## Sequencing

Independent — touches only `dashboard-skeleton.tsx`; no dependency on
`admin-products-tab-state` or any other change in this batch.
