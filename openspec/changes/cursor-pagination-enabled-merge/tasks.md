## 1. Fix the `enabled` merge

- [ ] 1.1 `apps/web/src/lib/use-cursor-pagination.ts`: change
      `{ ...built, enabled: options.enabled }` to
      `{ ...built, enabled: options.enabled ?? built.enabled }`
- [ ] 1.2 Add a unit test: a factory that returns `enabled: false` in its
      built options, called with `options.enabled` omitted, produces a
      `useCursorPagination` result whose underlying query is disabled
- [ ] 1.3 Add a unit test: a factory that returns `enabled: false`, called
      WITH an explicit `options.enabled: true`, produces an enabled query
      (confirms the explicit-override path is unchanged)
- [ ] 1.4 Confirm `action-log-tab.tsx` (the sole current caller) is
      unaffected — it passes no `enabled`, and its factory sets none either,
      so `built.enabled` is `undefined` before and after this change

## 2. Gates

- [ ] 2.1 `pnpm --filter @customreport/web test`
- [ ] 2.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 2.3 `openspec validate cursor-pagination-enabled-merge --strict`
