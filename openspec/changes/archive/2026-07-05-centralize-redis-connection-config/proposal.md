## Why

Five API consumers each construct their Redis connection by inlining the same
two-line read: `host: requireEnv(process.env, "REDIS_HOST")` and
`port: Number(requireEnv(process.env, "REDIS_PORT"))`. The literal
`?? "localhost"` / `?? 6379` fallbacks are already gone (commit `ee4c11b2`),
but the copy-pasted `requireEnv(process.env, ...)` construction that replaced
them is now duplicated across `bullmq-options.ts`, `redis.health.ts`,
`session-revocation.service.ts`, `analytics.cache.ts`, and
`telemetry.cache.ts`. Every site re-reads raw `process.env` and re-coerces the
port with `Number(...)`, even though `ConfigModule` already exposes the
validated `EnvConfig` (typed `REDIS_HOST: string`, `REDIS_PORT: number`) under
the `ENV_CONFIG` token. Two sources of truth, five places a future
default/typo could creep back in, and no single seam a reviewer can guard.

## What Changes

- Add one `buildRedisConnectionOptions(env)` helper that derives
  `{ host, port }` from the validated `EnvConfig` — no `process.env` read, no
  `Number(...)` coercion, no fallback or default.
- Route all five consumers through the helper: each spreads its
  `{ host, port }` and keeps its own per-client resilience flags
  (`lazyConnect`, `maxRetriesPerRequest`, `enableOfflineQueue`) at the call
  site, because those legitimately differ per consumer and are not env-derived.
- Delete every inline `requireEnv(process.env, "REDIS_HOST")` /
  `Number(requireEnv(process.env, "REDIS_PORT"))` pair from the five consumers.
- Keep `REDIS_HOST` / `REDIS_PORT` REQUIRED in the env schema (no `.default()`)
  so a missing var still fails boot loud — the helper reads only already-validated
  values.

## Non-goals

- No change to Redis semantics, key prefixes, pooling, or any per-consumer
  resilience flag values — this is a behavior-preserving refactor.
- No new dependency (no `@nestjs/config`); reuse the existing `ENV_CONFIG`
  token idiom.
- No change to `env.schema.ts` field definitions for `REDIS_HOST`/`REDIS_PORT`
  (they are already correctly required); this change only removes duplication
  downstream.

## Capabilities

### New Capabilities

- `redis-connection-config`: a single validated-env-backed source for the
  Redis host/port used to construct every ioredis / BullMQ connection in the
  API, with no per-consumer `process.env` reads and no silent fallback.

### Modified Capabilities

<!-- None — no existing spec governs Redis connection construction. The
no-fallback principle in lint-max-strictness-standard is referenced, not
modified. -->

## Impact

- New: `apps/api/src/infrastructure/config/redis-connection.ts` —
  `buildRedisConnectionOptions(env)`.
- `apps/api/src/infrastructure/bullmq/bullmq-options.ts` — `host`/`port` from
  the helper; keeps `maxRetriesPerRequest: null`.
- `apps/api/src/infrastructure/health/redis.health.ts` — helper + `lazyConnect`.
- `apps/api/src/modules/admin/session-revocation.service.ts` — helper +
  `lazyConnect`/`maxRetriesPerRequest: 1`/`enableOfflineQueue: false`.
- `apps/api/src/modules/analytics/analytics.cache.ts` — same shape via helper.
- `apps/api/src/modules/telemetry/telemetry.cache.ts` — same shape via helper.
- `getBullMQConnectionOptions` gains an `EnvConfig` param, and it fans out
  through `getBullMQOptions(env)` to nine call sites: the 5 Nest providers
  (`BullBoardQueues`, `PdfExportProcessor`, `EmailReminderProcessor`,
  `DLQMonitorService`, `TelegramQueue`) inject `ENV_CONFIG`; `bullmq.module.ts`
  switches `forRoot` → `forRootAsync`; and the two direct `new Queue(...)` calls
  in `main.ts` bootstrap read `app.get(ENV_CONFIG)`. See `design.md` decision 3.
- Tests: only `session-revocation.service.ts` has an injected-`Redis`
  constructor seam (`constructor(redis?: Redis)`) — unchanged. `analytics.cache.ts`
  and `telemetry.cache.ts` have a parameterless `constructor()` that builds the
  client inline; each gains an `ENV_CONFIG` injection. Add a focused unit test
  for the helper.
