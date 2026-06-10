# Refactor Test DB Cleanup to TRUNCATE With a \_test Guard

## Why

Every integration test wipes the database through `cleanDatabase` in
`apps/api/src/test-utils/prisma-test-helper.ts` (lines 29–61): 21
hand-ordered `deleteMany` calls. The schema has 26 models — five tables
are never cleaned (`ViewerGroupAccess`, `UserActionLog`, `AppSettings`,
`Organization`, `TelegramBinding`), so `UserActionLog` rows silently
leak between tests. Three in-file comments (UFB-036, 35-04, UFB-054)
document that every new FK forced a manual re-ordering episode. And the
helper has zero guard: it deletes from whatever `DATABASE_URL` points
at — a dev shell pointing at `customreport_dev` would be wiped silently.

## What Changes

1. Replace the 21 ordered `deleteMany` calls with the proven in-repo
   pattern from `prisma/reset-hard.ts` `truncateAll()` (lines 121–142):
   discover tables from `pg_tables` (excluding `_prisma_migrations`),
   memoize the list, issue one `TRUNCATE TABLE ... RESTART IDENTITY
CASCADE` via `$executeRawUnsafe`. New models are picked up
   automatically; FK order becomes irrelevant.
2. Add `assertTestDatabaseUrl`: `cleanDatabase` refuses to run unless
   the database name in `DATABASE_URL` ends with `_test` — stricter
   than `prisma/_destructive-guard.ts`, which trusts localhost
   unconditionally. **BREAKING** for misconfigured local runs: a shell
   pointed at a non-`_test` DB now fails loudly instead of being wiped.
   That error is the feature, not a regression.
3. New unit test (guard matrix, runs in default `pnpm test`) and a new
   integration test proving previously-leaked tables are wiped and
   `seedTestData` works on the post-TRUNCATE empty DB.

The `cleanDatabase`/`seedTestData`/`TEST_IDS` interface is unchanged —
the 16 existing integration suites need no edits. Behavior delta:
`AppSettings`/`Organization` singletons stop surviving across tests;
all production reads are upserts and no integration suite reads them
from DB. Fallback if the full suite disagrees: exclusion list.

**Non-goals:** no codegen step; no `cascadeOnDelete` schema rewrite; no
edits to `prisma/` scripts or `_destructive-guard.ts` itself; the
Playwright e2e path (`e2e/integration/helpers/db.ts`,
`E2E_DATABASE_URL` → `customreport_e2e`) stays untouched — its name
does not end with `_test` and must not receive this assert.

## Sequencing

Wave 0 — independent; land EARLY: the 16 integration suites are the
safety net for the api-side changes (`refactor-trpc-infra-duplication`
leans on them).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `destructive-db-guard`: ADDED requirement — the integration-test
  cleanup helper MUST assert a `_test`-suffixed database name in
  `DATABASE_URL` before any destructive operation.

## Impact

- `apps/api/src/test-utils/prisma-test-helper.ts` — primary edit.
- NEW `apps/api/src/test-utils/prisma-test-helper.test.ts` (unit).
- NEW `apps/api/src/test-utils/prisma-test-helper.integration.test.ts`.
- `openspec/specs/destructive-db-guard/spec.md` — receives the delta on
  archive; not hand-edited during implementation.
