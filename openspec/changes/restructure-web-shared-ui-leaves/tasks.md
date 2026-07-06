## 1. Relocate the two rule-of-2 leaf components (behavior-neutral)

- [x] 1.1 `git mv` `components/search/search-input.tsx` and its co-located
      `search-input.test.tsx` to `apps/web/src/shared/ui/`; `git mv`
      `components/auth/if-role.tsx` and `if-role.test.tsx` to the same
      `shared/ui/`; remove the emptied `components/search/` and `components/auth/`
      directories (both held only the moved pair). Filenames unchanged.
- [x] 1.2 Confirm the moved files' relative imports need NO depth change: both
      go from a two-deep `components/<domain>/` dir to the two-deep `shared/ui/`
      dir, so `../../lib/session-provider` and `../../lib/trpc-context` (and the
      test `vi.mock` paths) stay valid. The tests' `./search-input` / `./if-role`
      self-imports stay valid.
- [x] 1.3 Reroute the five consumer imports from the legacy paths to
      `shared/ui/*` (same `../../../` depth, path swap only): `reports/page.tsx` + `page.test.tsx` and `features/admin/ui/products-tab.tsx` +
      `products-tab.test.tsx` (`SearchInput`), and `features/dashboard/ui/alert-bar.tsx`
      (`IfRole`); re-sort each import group (`simple-import-sort`). Grep
      `components/search` / `components/auth` repo-wide to confirm no consumer remains.

## 2. Verify (behavior-neutral)

- [x] 2.1 Focused `pnpm exec eslint --max-warnings 0` over the four moved files
      plus the five rerouted consumers green (no new exemption needed).
- [x] 2.2 `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` green (proves
      the relative-import depth is correct — the one trap for this move).
- [x] 2.3 Run the moved suites + consumers via `pnpm exec vitest run <paths>`,
      then the full web unit suite (`pnpm exec vitest run`) green — 1567 passed.
      No `.js`-extension shared-src import introduced, so the webpack
      module-resolution 500 the unit gate is blind to does not apply.
- [x] 2.4 `openspec validate restructure-web-shared-ui-leaves --strict` green.
