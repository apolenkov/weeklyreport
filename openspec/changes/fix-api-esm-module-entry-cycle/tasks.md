## 1. API module entries and boundaries

- [x] 1.1 Move the eager `PeriodModule` export from `period/index.ts` to the explicit `period/module.ts` composition entry and repoint `AppModule`.
- [x] 1.2 Allow `module.ts` entries only for API bootstrap/infrastructure consumers while preserving the sibling-module `index.ts` boundary.

## 2. Regression verification

- [x] 2.1 Add a regression test that imports `AppModule` through the production TypeScript ESM loader.
- [x] 2.2 Start the source API and confirm `/health/live` succeeds without an initialization-cycle error.

## 3. Repository gates

- [x] 3.1 Run `pnpm --filter @customreport/api db:generate`.
- [x] 3.2 Run `pnpm typecheck`.
- [x] 3.3 Run `pnpm lint`.
- [x] 3.4 Run `pnpm test` and `pnpm --filter @customreport/api test:integration`.
- [x] 3.5 Run `pnpm build` and `openspec validate fix-api-esm-module-entry-cycle --strict`.
