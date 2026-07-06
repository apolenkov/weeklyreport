## 1. Dissolve the admin folder (behavior-neutral)

- [x] 1.1 `git mv` the 25 admin-canonical files to `features/admin/`: the 20
      `ui` components → `apps/web/src/features/admin/ui/` and the 5 pure
      utils/hooks/config (`action-log-format`, `reminders-form-state`,
      `reminders-tab-format`, `reminders-tab-mutations`, `timezone-options`) →
      `apps/web/src/features/admin/model/`, per the mapping's `Layer` column.
      Move the 9 co-located admin `*.test.tsx` (`group-products-editor`,
      `groups-tab`, `jobs-tab-label`, `jobs-tab`, `product-group-chips`,
      `products-tab`, `reminders-tab`, `settings-tab`, `users-tab`) beside their
      source into `features/admin/ui/`. **`git reset` after each move** so nothing
      of this session sits in the shared index.
- [x] 1.2 `git mv` the 11 period-lifecycle files to `features/period/`: the 10
      `periods-*` / `settings-periods-*` components → `features/period/ui/` (carry
      `periods-tab.test.tsx` beside `periods-tab.tsx`) and `use-period-mutations.ts`
      → `features/period/model/`. `git reset` after.
- [x] 1.3 `git mv` the 3 `reopen-*` files to `features/review/ui/` and the 3
      `settings-identity/integrations/notifications` sub-tabs to
      `features/organization/ui/`. `git reset` after.
- [x] 1.4 `git mv` the three ≥2-slice primitives out of the slice tree:
      `settings-tab-shared.tsx` → `shared/ui/settings-tab-shared.tsx`,
      `tab-count-pill.tsx` → `shared/ui/tab-count-pill.tsx`, and `mock-data.ts` →
      `shared/lib/admin-mock-data.ts` (renamed to avoid colliding with the landed
      `shared/lib/dashboard-mock-data.ts`). `git reset` after. Confirm the emptied
      `apps/web/src/components/admin/` directory no longer exists.

## 2. Recompute imports (no barrels beyond the admin slice)

- [x] 2.1 Recompute every moved file's cross-directory imports from its new
      location — the slice tree is one level deeper and under a different top
      segment than `components/admin/`. Intra-segment `./`-relative imports between
      files landing in the SAME target stay unchanged; imports crossing a segment
      (a moved file → `../../../components/ui/*`, `../../../lib/mappers`,
      `../../../hooks/*`) are recomputed, not blindly prefixed.
- [x] 2.2 Reroute every consumer of the three graduated primitives to the new
      `shared/*` paths: importers of `settings-tab-shared` (period + organization +
      admin sub-tabs) and `tab-count-pill` (`jobs-tab-label`, `reopen-tab-label`)
      to `shared/ui/*`; every `mock-data` type/const importer to
      `shared/lib/admin-mock-data`. Grep `components/admin/`, `admin/mock-data`,
      `settings-tab-shared`, and `tab-count-pill` repo-wide to prove no legacy path
      remains.
- [x] 2.3 Point the admin composition roots at their sibling sub-tabs by direct
      recomputed-relative path (NOT a barrel — `period`/`review`/`organization` are
      unregistered this change): `admin-panel.tsx` → `features/period/ui/periods-tab`
      (`PeriodsTab`) and `features/review/ui/reopen-tab` (`ReopenTab`);
      `settings-tab.tsx` → the three `features/organization/ui/*` sub-tabs and
      `features/period/ui/settings-periods-sub-tab`. Leave a short comment on each
      such import noting it converts to a sibling-barrel import when that slice
      registers in the paired `lead/` change.

## 3. Register + barrel the admin slice only

- [x] 3.1 Add `apps/web/src/features/admin/index.ts` exporting exactly the symbols
      the routes load (`AdminPanel`; add `ProductsTab` only if
      `app/(app)/admin/products/page.tsx` consumes it directly). Reroute both
      `app/(app)/admin/page.tsx` and `app/(app)/admin/products/page.tsx` off the
      legacy internal paths to the barrel.
- [x] 3.2 AMENDED (implementation finding): append NOTHING to `webSlices` this
      change. The zone keys on the importer, so registering `admin` while
      `admin-panel.tsx`/`settings-tab.tsx` still import `period`/`review`/
      `organization` internals trips six zone errors (proven via temp-append
      probe, then reverted). All four seeded slices register with the change
      that relocates the composition roots. Proposal + spec delta updated to
      match.
- [x] 3.3 Repoint the six admin `eslint.config.ts` exemptions: `mock-data.ts`
      (max-lines block + `sonarjs/no-duplicate-string` block) →
      `shared/lib/admin-mock-data.ts`; `users-tab.tsx`, `groups-tab.tsx`,
      `products-tab.tsx` (max-lines) → `features/admin/ui/*`; `admin-panel.tsx`
      (complexity) → `features/admin/ui/admin-panel.tsx`.

## 4. Verify (behavior-neutral, fail-closed)

- [x] 4.1 Focused `pnpm exec eslint` over every moved/rerouted file
      (`--max-warnings 0`) green — proves the six exemptions carried, the deeper
      paths surfaced no new violation, and the admin composition roots' direct
      imports into unregistered period/review/organization do NOT trip a zone. Run
      `pnpm typecheck` (the reroute touches type-only imports esbuild strips without
      resolving).
- [x] 4.2 Run the 10 moved slice tests plus every rerouted consumer's tests via
      `cd apps/web && pnpm exec vitest run <paths>` (never wrap vitest in rtk).
      Full web unit gate green.
- [x] 4.3 Prove the `admin` cross-slice zone fails closed: add a synthetic import
      from `features/admin` internals into another registered slice, confirm eslint
      errors on it, then delete the probe.
