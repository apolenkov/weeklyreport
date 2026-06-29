## 1. PrismaService — pool error listener and config

- [ ] 1.1 In `PrismaService` constructor (`apps/api/src/infrastructure/prisma/prisma.service.ts`),
      read `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, and `DB_POOL_CONNECTION_TIMEOUT_MS`
      from `process.env`. Extract a small named helper (e.g.
      `parsePositiveInt(raw, fallback)` for `DB_POOL_MAX` and
      `parseNonNegativeInt(raw, fallback)` for the two timeouts) that parses each
      var as a FULL-STRING integer and range-validates: `DB_POOL_MAX` must be a
      positive integer (`>= 1`); the timeouts must be non-negative integers
      (`>= 0`). Do NOT use `parseInt` — it accepts partially-numeric and decimal
      strings (`parseInt('10junk')` → `10`, `parseInt('1.5')` → `1`); instead
      accept a value only when `Number.isSafeInteger(Number(raw.trim()))` holds on
      the non-empty trimmed string, then apply the range check. Fall back to `10`,
      `10000`, `0` respectively when the value is absent, empty, non-integral, OR
      out of range (negative, and zero for `DB_POOL_MAX`) — never pass a
      malformed/negative/zero value through to `pg`.
- [ ] 1.2 Pass the resolved values as `max`, `idleTimeoutMillis`, and
      `connectionTimeoutMillis` to the `pg.Pool` constructor alongside
      `connectionString`.
- [ ] 1.3 Immediately after constructing the pool (still in the constructor),
      add `pool.on('error', (err: Error) => { this.logger.error(...) })`. Pass a
      single string argument that embeds
      `JSON.stringify({ phase: 'pg.pool.error', message: err.message })` (matching
      the existing `slow query ${JSON.stringify(...)}` line in this file). Do NOT
      pass the object as the message arg or as a second argument: the active
      `NestAppLoggerAdapter` `String(...)`-coerces the first arg and treats the
      second as the Nest log context, so only the embedded-string form preserves
      the `phase`/`message` fields.
- [ ] 1.4 In `onModuleInit`, after `await this.$connect()`, log the resolved
      pool configuration (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`)
      alongside the existing "Database connection established" message at
      `Logger.log` (info) level.

## 2. Env examples

- [ ] 2.1 In `.env.example`, add a commented block after the `DATABASE_URL`
      line with the three new vars, each with its default value and a short comment
      describing the advisory (e.g. keep `DB_POOL_MAX` below the DB server's
      `max_connections`).
- [ ] 2.2 Mirror the same block in `.env.test.example`, placed after the
      `E2E_DATABASE_URL` line (this file has no `DATABASE_URL` line — do not add
      one).

## 3. Verification

- [ ] 3.1 Run `pnpm typecheck` — zero type errors.
- [ ] 3.2 Run `pnpm lint` — zero lint errors or warnings introduced by this
      change.
- [ ] 3.3 Run `pnpm test` — all existing tests pass. Add unit tests for the
      parse-and-range-validate helper(s) covering, at minimum: a valid value
      (passes through), absent/empty (default), non-numeric (default),
      partially-numeric `DB_POOL_MAX=10junk` (→ `10`, NOT `parseInt`'s `10`-prefix
      acceptance — assert it falls back), decimal `1.5` (→ default, NOT `1`),
      `DB_POOL_MAX=0` (→ `10`), `DB_POOL_MAX=-1` (→ `10`), and a negative timeout
      (→ its default). At least one test MUST assert the resolved value handed to
      `pg.Pool` matches the value logged at boot (the "boot log must not lie" case).
- [ ] 3.4 Add a focused test that proves the pool error listener works: construct
      `PrismaService` against a `pg.Pool` test double (or an `EventEmitter` stub
      injected for the pool) with the `logger` spied, emit a synthetic
      `error` event on the pool, and assert (a) `logger.error` is called exactly
      once with a single string argument that embeds `phase: 'pg.pool.error'` and
      the error message, and (b) emitting the event does NOT throw / does not reach
      an uncaught-exception path (the test process stays alive). This is the
      core crash-prevention contract and MUST be covered, not only spot-verified.
- [ ] 3.5 Spot-verify in the running dev API (`pnpm dev:watch`): the boot log
      contains a line with `pg.pool.error listener registered` or the resolved pool
      config values.
