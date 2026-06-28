## 1. PrismaService — pool error listener and config

- [ ] 1.1 In `PrismaService` constructor (`apps/api/src/infrastructure/prisma/prisma.service.ts`),
      read `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, and `DB_POOL_CONNECTION_TIMEOUT_MS`
      from `process.env`; parse each with `parseInt`; fall back to `10`, `10000`, `0`
      respectively when absent or non-numeric.
- [ ] 1.2 Pass the resolved values as `max`, `idleTimeoutMillis`, and
      `connectionTimeoutMillis` to the `pg.Pool` constructor alongside
      `connectionString`.
- [ ] 1.3 Immediately after constructing the pool (still in the constructor),
      add `pool.on('error', (err: Error) => { this.logger.error(...) })` with a
      JSON payload of `{ phase: 'pg.pool.error', message: err.message }`.
- [ ] 1.4 In `onModuleInit`, after `await this.$connect()`, log the resolved
      pool configuration (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`)
      alongside the existing "Database connection established" message at
      `Logger.log` (info) level.

## 2. Env examples

- [ ] 2.1 In `.env.example`, add a commented block after the `DATABASE_URL`
      line with the three new vars, each with its default value and a short comment
      describing the advisory (e.g. keep `DB_POOL_MAX` below the DB server's
      `max_connections`).
- [ ] 2.2 Mirror the same block in `.env.test.example`.

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` — zero type errors.
- [ ] 3.2 Run `pnpm lint` — zero lint errors or warnings introduced by this
      change.
- [ ] 3.3 Run `pnpm test` — all existing tests pass; add a unit test for the
      `parseInt`-with-fallback parsing logic if the helper is extracted to a
      testable function (inline constants require no test).
- [ ] 3.4 Spot-verify in the running dev API (`pnpm dev:watch`): the boot log
      contains a line with `pg.pool.error listener registered` or the resolved pool
      config values.
