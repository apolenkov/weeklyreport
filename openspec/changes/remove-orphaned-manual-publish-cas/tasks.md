# Tasks

## 1. Reachability proof

- [x] 1.1 Repo-wide grep for `publishAssembledReport`, `PublishReportOutcome`, `PublicationAccessError`, `PublicationArchivedError` — record every hit; abort any deletion whose symbol has a production caller

## 2. Removal

- [x] 2.1 Delete `publishAssembledReport` and `PublishReportOutcome` from the publication repository + port; prune their unit/integration tests
- [x] 2.2 Delete `PublicationAccessError`/`PublicationArchivedError`, their exports, error-mapper rows, and mapper test cases
- [x] 2.3 Confirm the shared CAS helper needs no edit (its manual-branch parameters may simplify — only if no other caller uses them)

## 3. Gates

- [x] 3.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck`
- [x] 3.2 `pnpm lint`
- [x] 3.3 `pnpm test`
- [x] 3.4 `pnpm --filter @customreport/api test:integration`
