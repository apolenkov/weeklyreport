## 1. Shared builder (api infrastructure)

- [x] 1.1 Add `apps/api/src/infrastructure/config/redis-connection.ts` exporting
      `buildRedisConnectionOptions(env: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT">)`
      returning `{ host: env.REDIS_HOST, port: env.REDIS_PORT }` — no
      `process.env` read, no `Number(...)`, no fallback/`.default`.
- [x] 1.2 Add a focused unit test asserting the helper returns the validated
      host/port unchanged and reads nothing from `process.env`.

## 2. Thread `EnvConfig` into the BullMQ options and every caller

- [x] 2.1 `infrastructure/bullmq/bullmq-options.ts` — give
      `getBullMQConnectionOptions(env)` and `getBullMQOptions(env)` an `EnvConfig`
      param; build `host`/`port` from `buildRedisConnectionOptions(env)` and keep
      `maxRetriesPerRequest: null`. No `process.env` read, no `Number(...)`.
- [x] 2.2 `infrastructure/bullmq/bullmq.module.ts` — switch
      `BullModule.forRoot(getBullMQOptions())` to
      `forRootAsync({ inject: [ENV_CONFIG], useFactory: (env) => getBullMQOptions(env) })`.
- [x] 2.3 `infrastructure/bullmq/bull-board.module.ts` (`BullBoardQueues`) —
      inject `ENV_CONFIG`. Because an ES2022 class-field initializer cannot read a
      constructor param, MOVE the `pdfQueue`/`emailQueue` creation out of the field
      initializers (lines 35-36) into the constructor body, passing
      `getBullMQOptions(env)`. `mountBullBoard` needs no change — it reads the
      queues via `_app.get(BullBoardQueues)` and constructs no connection.
- [x] 2.4 `infrastructure/bullmq/pdf-export.processor.ts` — inject `ENV_CONFIG`;
      pass `getBullMQOptions(env)` at the existing call site (line 68).
- [x] 2.5 `infrastructure/bullmq/email-reminder.processor.ts` — inject
      `ENV_CONFIG`; pass `getBullMQOptions(env)` where it spreads the options
      (line 114).
- [x] 2.6 `infrastructure/bullmq/dlq-monitor.service.ts` — inject `ENV_CONFIG`;
      pass `getBullMQOptions(env)` (line 48).
- [x] 2.7 `modules/telegram/telegram.queue.ts` — inject `ENV_CONFIG`; pass
      `getBullMQOptions(env)` where it spreads the options (line 85).
- [x] 2.8 `apps/api/src/main.ts` bootstrap — the two direct `new Queue(...)` calls
      (`email-reminder` at line 329, `telegram-outbound` at line 337) read the
      validated env via `app.get(ENV_CONFIG)` and pass `getBullMQOptions(env)`.
- [x] 2.9 Update the test-time DIRECT constructions that bypass Nest DI so
      typecheck stays green under the new required params: pass a stub `EnvConfig`
      to `new PdfExportProcessor(...)` (pdf-export.processor.test.ts, 7 sites),
      `new EmailReminderProcessor(...)` (email-reminder.processor.test.ts +
      email-dispatch.integration.test.ts), `new DLQMonitorService()`
      (dlq-monitor.service.test.ts:21), and `getBullMQOptions(env)`
      (jobs.integration.test.ts:26). Providers wired via
      `Test.createTestingModule` need no change (DI supplies `ENV_CONFIG`).

## 3. Route the ioredis consumers through the builder

- [x] 3.1 `infrastructure/health/redis.health.ts` — inject `ENV_CONFIG`; replace
      the inline reads with `...buildRedisConnectionOptions(env)` and keep
      `lazyConnect: true`.
- [x] 3.2 `modules/admin/session-revocation.service.ts` — inject `ENV_CONFIG`
      into the default (non-test) construction path; spread the helper and keep
      `lazyConnect`/`maxRetriesPerRequest: 1`/`enableOfflineQueue: false`. Leave
      the existing optional injected-`Redis` test seam (`constructor(redis?: Redis)`)
      untouched.
- [x] 3.3 `modules/analytics/analytics.cache.ts` — the parameterless
      `constructor()` gains an `ENV_CONFIG` injection; spread
      `...buildRedisConnectionOptions(env)` and keep the three resilience flags.
      (No injected-`Redis` seam exists here — do not invent one.)
- [x] 3.4 `modules/telemetry/telemetry.cache.ts` — same as 3.3: the parameterless
      `constructor()` gains an `ENV_CONFIG` injection; spread the helper; keep the
      three resilience flags.
- [x] 3.5 DI-external `SessionRevocationService` bootstrap sites the design's
      decision-3 enumeration MISSED (it claimed the service flows only through the
      Nest provider): `main.ts` PDF-download handler and `trpc.context.ts`
      context factory each construct it directly with `new SessionRevocationService()`.
      Both now pass the validated env (`app.get<EnvConfig>(ENV_CONFIG)` /
      `_app.get<EnvConfig>(ENV_CONFIG)`) so the fail-loud env guard is satisfied.
- [x] 3.6 `modules/telegram/telegram.queue.test.ts` — the `TestProcessor extends
  TelegramProcessor` subclass inherits the new required `env` param (not caught
      by the task 2.9 `new TelegramProcessor(` grep); its 5 construction sites now
      pass a stub `EnvConfig`.

## 4. Prove nothing regressed

- [x] 4.1 Grep `bullmq-options.ts` and the four ioredis consumers to confirm zero
      remaining `requireEnv(process.env, "REDIS_HOST")` /
      `Number(requireEnv(process.env, "REDIS_PORT"))`.
- [x] 4.2 Confirm `env.schema.ts` still declares `REDIS_HOST`/`REDIS_PORT` as
      required with no `.default()` (no edit expected — this is a guard check).
- [x] 4.3 Confirm every resilience-flag value is byte-for-byte the same as before
      (behavior-preserving diff review).

## 5. Verification

- [x] 5.1 `pnpm --filter @customreport/api db:generate` (Prisma client), then
      `pnpm typecheck` (proves every `getBullMQOptions(env)` caller now supplies env).
- [x] 5.2 `pnpm lint` (eslint clean, `--max-warnings 0`; new file needs no
      `eslint.config.ts` exempt entry).
- [x] 5.3 `pnpm test` (helper unit test + cache/session/health suites green).
- [x] 5.4 Boot the api from source and hit `/health` to confirm the Redis probe
      and BullMQ queues connect with the centralized options.
- [x] 5.5 `openspec validate "centralize-redis-connection-config" --strict`
      (prints "is valid").
