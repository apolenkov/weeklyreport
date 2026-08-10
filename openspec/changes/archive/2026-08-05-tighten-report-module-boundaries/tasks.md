## 1. API report-section projection boundary

- [x] 1.1 Move published snapshot and escalation projection sources plus their focused tests into `report-sections/infrastructure/` without changing logic.
- [x] 1.2 Export the external projection surface from `report-sections/index.ts` and reroute archive, PDF export, period, publication, and weekly-report consumers through that facade.
- [x] 1.3 Delete the loose-root projection exceptions from `eslint-config/boundaries.ts` and prove no production or test import reaches the old/internal paths.
- [x] 1.4 Run the moved projection suites, affected repository/service suites, API TypeScript, strict ESLint, and the API boundary negative tests; commit the API slice independently.

## 2. Web report-history feature boundary

- [x] 2.1 Move report-history role/query state into `features/period/model/` and panel/toolbar presentation into `features/period/ui/`, preserving source behavior.
- [x] 2.2 Add only the four route entry points to `features/period/index.ts`, update mocks/imports, and leave `/reports/page.tsx` as composition-only.
- [x] 2.3 Prove no report-history implementation remains in the route tree and no consumer imports period internals directly.
- [x] 2.4 Run the affected history/page/component suites, web TypeScript, strict ESLint, and catalog drift check; commit the web slice independently.

## 3. Verification and planning closeout

- [x] 3.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter @customreport/api test:integration`, `pnpm catalog:check`, and `openspec validate --all --strict`; record exact exits in `verification.md`.
- [x] 3.2 Run exact-final-SHA code-quality and architecture reviews, resolve all blockers, sync the `directory-architecture-standard` delta, and archive this change before freezing runtime-sweep evidence.
