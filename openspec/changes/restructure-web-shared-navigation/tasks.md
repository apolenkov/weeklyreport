## 1. Relocate the navigation chrome (behavior-neutral)

- [x] 1.1 `git mv` the two nav components (`nav-bar.tsx`, `nav-bar-skeleton.tsx`)
      plus the co-located `nav-bar.test.tsx` from
      `apps/web/src/components/navigation/` to
      `apps/web/src/shared/ui/navigation/` (preserve rename detection; filenames
      unchanged; remove the emptied `components/navigation/` directory).
- [x] 1.2 Fix the deepened relative imports (one level added): in `nav-bar.tsx`
      and `nav-bar.test.tsx`, rewrite `../../lib/*` → `../../../lib/*` and
      `../dev/role-switcher` → `../../../components/dev/role-switcher`; re-sort the
      import groups (`simple-import-sort`). `nav-bar-skeleton.tsx` has no relative
      imports. The test's `./nav-bar` self-import stays valid.
- [x] 1.3 Reroute the one consumer `app/(app)/layout.tsx` to import `NavBar` and
      `NavBarSkeleton` from `shared/ui/navigation/*` directly (no barrel — none
      prescribed for `shared/`); re-sort its import group. Grep `components/navigation`
      repo-wide to confirm no other consumer remains.
- [x] 1.4 Update the two `eslint.config.ts` exemption entries pinning
      `nav-bar.tsx` (complexity + max-lines blocks) from `components/navigation/`
      to `shared/ui/navigation/`. `webSlices` is NOT touched (`shared/` is not a
      feature slice).

## 2. Verify (behavior-neutral)

- [x] 2.1 Focused `pnpm exec eslint --max-warnings 0` over the moved files + the
      rerouted `layout.tsx` + `eslint.config.ts` green (only the two pre-existing
      path-pinned exemptions cover nav-bar's complexity/size).
- [x] 2.2 Run the nav unit suite plus the layout consumer's tests via
      `cd apps/web && pnpm exec vitest run <paths>` (never wrap vitest in rtk).
- [x] 2.3 `openspec validate restructure-web-shared-navigation --strict` green.
