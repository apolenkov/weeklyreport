## Why

The parent change `restructure-directory-architecture` locked the target web
structure (`app/` routing + `features/<domain>/` slices + `shared/`) and its
machine-enforced import boundaries, then proved the mechanic with the `landing`
pilot (task 2.1). Task 3.1 mandates that the remaining web domains relocate one
slice at a time; the `shared/`-layer children (navigation, report-shell) already
landed. This child relocates two **rule-of-2 leaf components** whose real
consumers span more than one domain, so their home is `shared/ui/`, not any
feature slice.

Both files still live in the legacy flat `components/<domain>/` tree; their
placement is fixed by the authoritative mapping
`docs/architecture/mapping/missing-singles-2026-07-02.md`:

- `components/search/search-input.tsx` — consumed by `app/(app)/reports/page.tsx`
  (routing, fine) **and** the `admin` slice (`features/admin/ui/products-tab.tsx`).
  A second slice consumer beside the owning `search` domain trips rule-of-2 (web)
  → `shared/ui/`, which also matches the catalog's pre-collapsed `shared-ui`
  domain and avoids baking in an admin→search cross-slice import that zone 5 forbids.
- `components/auth/if-role.tsx` — the centralised role-guard render wrapper,
  consumed by the `dashboard` slice (`features/dashboard/ui/alert-bar.tsx`)
  beside the owning `auth` domain. Rule-of-2 (web) → `shared/ui/`, which removes
  the would-be dashboard→auth zone-5 violation rather than allowlisting it.

Grouped in one change because both are single-file, business-agnostic leaf
promotions to the same `shared/ui/` destination with an identical relocation
mechanic — the same shape as the navigation slice moving its two files as one unit.

## What Changes

- Relocate `components/search/search-input.tsx` (+ co-located `search-input.test.tsx`)
  to `apps/web/src/shared/ui/search-input.tsx`, filename unchanged.
- Relocate `components/auth/if-role.tsx` (+ co-located `if-role.test.tsx`) to
  `apps/web/src/shared/ui/if-role.tsx`, filename unchanged.
- The moved files stay two directories under `src/` (`components/<domain>/` →
  `shared/ui/`), so their `../../lib/*` relative imports are **unchanged** — no
  depth shift (unlike the navigation slice, which deepened by one level into
  `shared/ui/navigation/`).
- Reroute the consumers to import from `shared/ui/*` directly (no barrel — none
  prescribed for `shared/`):
  - `app/(app)/reports/page.tsx` + `page.test.tsx` (`SearchInput`)
  - `features/admin/ui/products-tab.tsx` + `products-tab.test.tsx` (`SearchInput`)
  - `features/dashboard/ui/alert-bar.tsx` (`IfRole`)
- Remove the emptied `components/search/` and `components/auth/` directories.
- **Behavior-neutral**: no component logic, props, or rendered output changes;
  pure relocation + import reroute.

## Non-goals

- No component logic, styling, or contract change — pure relocation.
- No new `features/<domain>` slice: both files are business-agnostic and reached
  by more than one domain, so they graduate to `shared/ui/`.
- No `eslint.config.ts` change: neither file carries a complexity/max-lines
  path-pinned exemption, and `shared/` is not a feature slice, so `webSlices`
  gains no entry.
- No relocation of the `lib/*` helpers the files depend on — they keep their
  homes this pass.

## Impact

- Affected code: `apps/web/src/shared/ui/{search-input,if-role}.{tsx,test.tsx}`
  (new), the deleted `components/search/` and `components/auth/` trees, and five
  rerouted consumer imports.
- Parent: `restructure-directory-architecture` task 3.1 — this change is that
  task's shared-layer leaf child. Mapping:
  `docs/architecture/mapping/missing-singles-2026-07-02.md`.
- No load-bearing invariant touched: both are read-only presentational helpers
  (`SearchInput` queries `search.*`; `IfRole` reads `auth.me`); no write path, no
  tRPC middleware chain.
