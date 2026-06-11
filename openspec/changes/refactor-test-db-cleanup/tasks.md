# Tasks — Refactor Test DB Cleanup to TRUNCATE With a \_test Guard

> **Execution note:** Sequential single-writer edits only; parallel
> agents only for read-only analysis (repo lesson: parallel mechanical
> edits pass gates but break behavior).

NOT STARTED — captured 2026-06-10. Facts verified at HEAD `3f5be66f`.
Reference pattern to mirror: `prisma/reset-hard.ts` `truncateAll()`
(lines 121–142, same PrismaPg adapter).

## 1. api — \_test-suffix guard (one commit)

- [x] 1.1 `apps/api/src/test-utils/prisma-test-helper.ts`: export
      `assertTestDatabaseUrl(url: string): void`. Extract the DB name —
      last path segment of the URL before `?`, lowercased — and throw
      unless it ends with `_test`. The error message names the
      offending DB name and says to point `DATABASE_URL` at the
      dedicated integration-test database; never echo credentials or
      the full URL. Wire it as the first statement of `cleanDatabase`,
      passing the module's `TEST_DATABASE_URL` const. JSDoc references
      `openspec/specs/destructive-db-guard/spec.md` and states why this
      is stricter than `assertNonProdDestructive` (localhost is NOT
      auto-trusted here — the helper wipes every table) and why
      `prisma/_destructive-guard.ts` is NOT imported (crosses the
      apps/api tsconfig rootDir; its contract allows any localhost DB
      unconditionally — exactly the hole being closed).
- [x] 1.2 NEW `apps/api/src/test-utils/prisma-test-helper.test.ts`
      (unit, pure string checks, no DB — runs in default `pnpm test`):
      accepts `postgresql://u:p@localhost:5432/customreport_test`, a
      remote host with `_test` suffix, and a URL with a `?schema=...`
      query string; rejects `/customreport`, `/customreport_dev`,
      `/customreport_uat`, `/customreport_prod`, `/customreport_e2e`;
      asserts the error message contains the offending DB name and the
      `_test` hint.

## 2. api — TRUNCATE cleanup (one commit)

- [x] 2.1 `apps/api/src/test-utils/prisma-test-helper.ts`: replace the
      body of `cleanDatabase` — delete the 21 ordered `deleteMany`
      calls and their FK-order comments (lines 29–61) outright; git
      history is the archive. New mechanism:
  - `discoverTables(prisma)`: `prisma.$queryRaw` tagged template
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND
tablename <> '_prisma_migrations'`; throw a loud error if zero
    rows ("did `prisma migrate reset` run?").
  - Quote identifiers as `"public"."Name"` with `"` → `""` escaping.
    The schema has no `@@map`, so physical tables are PascalCase, and
    unquoted `User` is an SQL keyword — quoting is mandatory.
  - Memoize the quoted comma-joined list in a module-level variable
    (schema is static per run; avoids one catalog query per
    `beforeEach`). Leave it unset on failure so the next call retries.
  - One statement:
    `prisma.$executeRawUnsafe(\`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE\`)`.
    Do NOT append a second `;`-separated statement — the Prisma
    `$executeRaw\*` contract is one statement per call. (No bind
    parameters means adapter-pg submits via the simple query protocol,
    so prepared-statement limits do not apply to TRUNCATE here.)
  - Keep `RESTART IDENTITY` for parity with reset-hard: all PKs are
    UUIDs today, so it is a no-op that future-proofs autoincrement.
  - Add a lock-invariant comment: TRUNCATE takes ACCESS EXCLUSIVE per
    table; safe only because `test:integration` pins
    `--fileParallelism=false` — revisit before any parallelism change.
    Note the hang symptom: an idle-in-transaction connection to
    `customreport_test` (dev API server, Prisma Studio) makes
    `cleanDatabase` hang as a `beforeEach` timeout, not an error;
    diagnose via `pg_stat_activity`.
  - CASCADE caveat for future exclusion-list edits: CASCADE silently
    truncates non-listed tables referenced by listed ones — only
    FK-isolated tables (today: `_prisma_migrations`) may be excluded.
  - Interface unchanged: `createTestPrisma` / `cleanDatabase` /
    `seedTestData` / `TEST_IDS` signatures stay as-is; zero edits to
    the 16 consumer suites.
- [x] 2.2 NEW
      `apps/api/src/test-utils/prisma-test-helper.integration.test.ts`
      (picked up by the `src/**/*.integration.test.ts` glob in
      `apps/api/vitest.integration.config.ts`, which loads
      `../../.env.test`): insert a `UserActionLog` row (the verified
      latent leak), an `AppSettings` row, and a `ViewerGroupAccess` row
      — tables today's `deleteMany` chain never touches; call
      `cleanDatabase`; expect all three counts 0; then `seedTestData`
      succeeds against the empty DB (FK integrity preserved).

## 3. docs — record results, close out

- [x] 3.1 Record the verification outputs below in this file and mark
      all tasks complete.

### Verification results (2026-06-11)

**4.1** `pnpm typecheck && pnpm lint && pnpm test` — all green.

- typecheck: 5 tasks successful (api + web + shared + ui).
- lint: ESLint no issues found.
- unit tests: api 77 files / 884 tests passed; web 104 files / 935
  tests passed.

**4.2** `pnpm --filter @customreport/api test:integration` — 25 passed,
1 skipped (telegram activation, requires real bot token — expected).
136 tests passed, 2 skipped. The new helper integration suite
(`prisma-test-helper.integration.test.ts`) verified that
`UserActionLog`, `AppSettings`, and `ViewerGroupAccess` are all wiped,
and `seedTestData` succeeds on the post-TRUNCATE empty DB.

**weekly-report.scope-filter pre-existing fix:** the test was broken
before this change — commit `b44400b6` tightened `GroupProduct` from
`@@unique([groupId, productId])` to `@@unique([productId])` (B1:
one-product-per-group invariant), but the test still tried to insert one
product into two groups. Updated test to match the current constraint:
product assigned to group A is visible to head-A and invisible to head-B
(correct scope isolation). Pre-TRUNCATE failure confirmed by restoring
the old `deleteMany` helper — same `UniqueConstraintViolation` on first
`createMany`.

**4.3** Negative check with
`DATABASE_URL="postgresql://u:p@localhost:5432/customreport_dev"`:

```
cleanDatabase refused: DATABASE_URL points at "customreport_dev",
which does not end with "_test". Point DATABASE_URL at the dedicated
integration-test database (e.g. customreport_test).
```

No SQL executed. Guard fires before any destructive operation.

## 4. Verification

- [x] 4.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
      all green. Gate caveat: `pnpm test` excludes
      `*.integration.test.ts`, so green standing gates do NOT exercise
      `cleanDatabase`; 4.2 is the real proof.
- [x] 4.2 `pnpm --filter @customreport/api test:integration` — the
      full integration run (25 existing files at HEAD) passes, plus the
      new helper integration suite. Of those 25, the 16 cleanDatabase
      consumers are the regression harness for this change:
      activity.prisma-repository, admin, archive, carry-over,
      group-scope, jobs, lead-form.prisma-repository, pdf-export,
      period-transition, publication, reminders, reminders.policy,
      report-sections, review, version-retention,
      weekly-report.scope-filter. Requires the local docker postgres
      with `customreport_test` up.
- [x] 4.3 Negative manual check: run the integration suite once with
      `DATABASE_URL` pointing at a non-`_test` database name — it MUST
      fail fast on `assertTestDatabaseUrl` before executing any SQL.
      Observed error message recorded above in §3.1.
