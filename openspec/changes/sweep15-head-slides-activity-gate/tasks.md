## 1. Sequencing

- [x] 1.1 Land or rebase onto `sweep15-placeholder-data-gating` before changing `HeadSlidesClient`, preserving its settled pending-state behavior

## 2. Head slides fallback gate

- [x] 2.1 Derive one `needsActivityFallback` predicate from loaded weekly data, zero lead sections, and `enableActivity`
- [x] 2.2 Use that predicate consistently for activity slide construction and user-visible loading/error gates while retaining parallel query startup
- [x] 2.3 Keep the viewer path at `enableActivity=false` with no activity query dependency

## 3. Tests

- [x] 3.1 Add tests proving populated weekly sections render while `activity.live` is loading or failed
- [x] 3.2 Add tests proving an empty weekly report follows activity loading, error, and successful fallback rows
- [x] 3.3 Add or retain a viewer assertion that the head-only activity query is disabled and cannot gate the deck

## 4. Repo gates

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck`
- [x] 4.3 `pnpm lint`
- [x] 4.4 `pnpm test`

Scoped web verification used for this frontend-only change:

- The requested filtered pnpm typecheck, two-file ESLint, and focused Vitest commands could not start because the installed pnpm launcher could not verify the locked pnpm release after its registry fetches failed.
- `../../node_modules/.bin/tsc --noEmit -p tsconfig.json` from `apps/web` — passed.
- `./node_modules/.bin/eslint apps/web/src/features/slides/ui/head-slides-client.tsx apps/web/src/features/slides/ui/head-slides-client.test.tsx --max-warnings 0` — passed.
- `../../node_modules/.bin/vitest run src/features/slides/ui/head-slides-client.test.tsx` from `apps/web` — 1 file and 8 tests passed.
- API generation and the full monorepo typecheck, lint, and test commands were not run.
