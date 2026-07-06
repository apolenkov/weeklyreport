## 1. Relocate the review comment list (behavior-neutral)

- [x] 1.1 `git mv` `components/review/review-comment-list.tsx` to
      `apps/web/src/shared/ui/review-comment-list.tsx`; remove the emptied
      `components/review/` directory. The file has no relative imports (depth
      unchanged, two under `src/`), so its body needs no edit.
- [x] 1.2 Reroute the two consumers to `shared/ui/review-comment-list`:
      `record-comments.tsx` (`../../review/…` → `../../../shared/ui/…`) and
      `lead-review-feedback.tsx` (`../review/…` → `../../shared/ui/…`); re-sort
      the import groups. Grep `components/review` repo-wide = 0.

## 2. Verify (behavior-neutral)

- [x] 2.1 Focused `pnpm exec eslint --max-warnings 0` over the moved file + two
      rerouted consumers green.
- [x] 2.2 `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` green.
- [x] 2.3 Full web unit suite (`pnpm exec vitest run`) green — 1567 passed. No
      `.js`-extension import introduced.
- [x] 2.4 `openspec validate restructure-web-shared-ui-review-comment-list --strict` green.
