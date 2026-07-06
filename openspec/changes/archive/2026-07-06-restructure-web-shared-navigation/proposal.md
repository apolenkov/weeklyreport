## Why

The parent change `restructure-directory-architecture` locked the target web
structure (`app/` routing + `features/<domain>/` slices + `shared/`) and its
machine-enforced import boundaries, then proved the mechanic end-to-end with the
`landing` pilot slice (task 2.1). Task 3.1 of that change mandates that **each
remaining web domain lands its own OpenSpec change**. The `analytics` charts
domain landed first (`restructure-web-analytics-slice`). This is the next child:
it relocates the app-wide **navigation chrome**.

Unlike a domain slice, the nav bar has no single owning feature — it is mounted
in `app/(app)/layout.tsx`, spans every domain (lead/head/admin), and depends
only on cross-cutting web helpers (`lib/role-home`, `lib/session-provider`,
`lib/web-env`, `components/dev/role-switcher`) plus `@customreport/shared`/
`@customreport/ui`. That makes it business-agnostic app-wide chrome, so its home
is `shared/ui/`, **not** `features/<domain>/ui/`. The two files still live in the
legacy flat `apps/web/src/components/navigation/` tree, so their placement is
guesswork. The per-file placement is already researched and fixed in
`docs/architecture/mapping/web-comp-navigation-2026-07-02.md` (source catalog
`docs/architecture/catalog/web-comp-navigation-2026-07-02.md`).

## What Changes

- Relocate the two navigation components from
  `apps/web/src/components/navigation/` to `apps/web/src/shared/ui/navigation/`,
  filenames unchanged, per the authoritative mapping:
  - `nav-bar.tsx` — role-aware app nav bar
  - `nav-bar-skeleton.tsx` — its hydration placeholder
- Move the co-located `nav-bar.test.tsx` alongside its component, preserving the
  relative layout. The move deepens the files by one directory level
  (`components/navigation/` → `shared/ui/navigation/`), so their `../../`
  relative imports into `lib/*` and `components/dev/*` become `../../../`; the
  `./nav-bar` self-import in the test stays valid.
- Reroute the one consumer, `app/(app)/layout.tsx`, to import `NavBar` and
  `NavBarSkeleton` from `shared/ui/navigation/*` directly. No barrel is added:
  `TARGET-STRUCTURE-2026-07-02.md` marks web barrels OPTIONAL and prescribes none
  for `shared/`; a two-file leaf reached by a single consumer expresses its
  boundary through the deep import, not a mega-barrel.
- Update the two `eslint.config.ts` exemption entries (complexity + max-lines)
  that pin `nav-bar.tsx` by path from `components/navigation/` to
  `shared/ui/navigation/`; the `webSlices` array is **unchanged** — `shared/` is
  not a feature slice and no cross-slice zone governs it.
- **Behavior-neutral**: no component logic, props, or rendered output changes;
  this is a pure relocation + import reroute.

## Non-goals

- No component logic, styling, or contract change — pure relocation.
- No new `features/<domain>` slice: nav chrome has no single owning domain, so it
  graduates to `shared/ui/` rather than any feature slice.
- No relocation of the `lib/*` / `components/dev/*` helpers nav depends on — they
  keep their current homes this pass; nav imports them at their real paths.
- No change to the boundary-zone mechanism itself (owned by the parent change);
  `webSlices` does not change.

## Impact

- Affected code: `apps/web/src/shared/ui/navigation/**` (new), the deleted
  `apps/web/src/components/navigation/` tree, `app/(app)/layout.tsx` (import
  reroute), `eslint.config.ts` (two exemption path updates).
- Parent: `restructure-directory-architecture` task 3.1 — this change is that
  task's shared-layer child. Mapping:
  `docs/architecture/mapping/web-comp-navigation-2026-07-02.md`.
- No load-bearing invariant touched (nav is a read-only presentational chrome; no
  write path, no tRPC middleware chain).
