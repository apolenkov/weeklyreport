## Context

The API opens Redis connections from five places, each re-deriving host/port
the same way:

| Consumer           | File                                          | Extra flags today                                                     |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| BullMQ options     | `infrastructure/bullmq/bullmq-options.ts`     | `maxRetriesPerRequest: null`                                          |
| Health probe       | `infrastructure/health/redis.health.ts`       | `lazyConnect: true`                                                   |
| Session revocation | `modules/admin/session-revocation.service.ts` | `lazyConnect`, `maxRetriesPerRequest: 1`, `enableOfflineQueue: false` |
| Analytics cache    | `modules/analytics/analytics.cache.ts`        | same as session revocation                                            |
| Telemetry cache    | `modules/telemetry/telemetry.cache.ts`        | same as session revocation                                            |

Every row currently starts with the identical pair:

```ts
host: requireEnv(process.env, "REDIS_HOST"),
port: Number(requireEnv(process.env, "REDIS_PORT")),
```

Meanwhile `infrastructure/config/config.module.ts` already exposes the validated
`EnvConfig` under the `ENV_CONFIG` Symbol token (`useFactory: validateEnv`),
where `REDIS_HOST` is a `string` and `REDIS_PORT` is a `number`
(`z.coerce.number().int().positive()`). The consumers ignore it and read raw
`process.env` instead — two sources of truth for the same two values.

`getBullMQConnectionOptions` is not a leaf: `getBullMQOptions()` wraps it and is
itself called from nine places across eight consumers — the 5 Nest providers
`BullBoardQueues` (two `new Queue(...)` fields), `PdfExportProcessor`,
`EmailReminderProcessor`, `DLQMonitorService`, `TelegramQueue`;
`bullmq.module.ts`'s `BullModule.forRoot`; and two direct `new Queue(...)` calls
in `main.ts` bootstrap. Giving `getBullMQConnectionOptions` an `EnvConfig`
parameter therefore ripples through `getBullMQOptions(env)` to every one of
them — each must supply the validated env (see decision 3). `mountBullBoard` is
NOT a call site: it reads the queues via `_app.get(BullBoardQueues)` and
constructs no connection itself.

## Goals / Non-Goals

**Goals:**

- One seam that owns the env→`{ host, port }` derivation, backed by the already
  validated `EnvConfig`.
- Remove the five duplicated `requireEnv(process.env, ...)` reads and the
  redundant `Number(...)` coercion.
- Preserve the no-silent-default contract: a missing var still fails boot loud.

**Non-Goals:**

- No change to any resilience-flag value or to Redis semantics — behavior is
  preserved exactly.
- No `@nestjs/config`; reuse the `ENV_CONFIG` token idiom.
- No move of the boot-time fence — `validateEnv()` in `main.ts` stays the
  earliest fail-closed point.

## Decisions

### 1. The builder returns only `{ host, port }`

`buildRedisConnectionOptions(env)` returns exactly the env-derived pair. The
per-consumer resilience flags (`lazyConnect`, `maxRetriesPerRequest`,
`enableOfflineQueue`) stay at each call site, spread after the helper:

```ts
new Redis({
  ...buildRedisConnectionOptions(env),
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
```

Rationale: those flags legitimately differ per consumer (BullMQ needs
`maxRetriesPerRequest: null`; the caches need `1`; the health probe needs
neither) and are not env-derived. Folding them into the helper would either
leak consumer-specific policy into a config primitive or require an options
bag that re-expands at every call site — more surface, not less. The helper
owns only the part that was actually duplicated and actually env-coupled.

### 2. Source is the validated `EnvConfig`, not `process.env`

The helper takes `env: Pick<EnvConfig, "REDIS_HOST" | "REDIS_PORT">` and returns
`{ host: env.REDIS_HOST, port: env.REDIS_PORT }`. Because `EnvConfig.REDIS_PORT`
is already a `number`, the `Number(...)` coercion disappears from every call
site. Because the field is already validated, the helper never needs a
presence check or a fallback — the fail-loud responsibility stays in the env
schema where it belongs.

### 3. Threading `EnvConfig` to the consumers

Four of the five ioredis consumers are Nest providers and inject `ENV_CONFIG`
directly: `redis.health.ts`, `analytics.cache.ts`, `telemetry.cache.ts`, and
`session-revocation.service.ts`. The fifth, `getBullMQConnectionOptions`, is a
plain function that fans out through `getBullMQOptions(env)` to nine call sites.
Giving the function an `EnvConfig` parameter ripples to all of them:

- 5 Nest providers call `getBullMQOptions()` and inject `ENV_CONFIG`:
  `BullBoardQueues`, `PdfExportProcessor`, `EmailReminderProcessor`,
  `DLQMonitorService`, `TelegramQueue`. For `BullBoardQueues`, the two `Queue`
  handles are today class-field initializers (`readonly pdfQueue = new Queue(...)`);
  under the target ES2022 class-field semantics an initializer cannot read a
  constructor parameter, so their creation MUST move into the constructor body
  that receives `ENV_CONFIG`.
- `bullmq.module.ts` switches `BullModule.forRoot(getBullMQOptions())` to
  `forRootAsync({ inject: [ENV_CONFIG], useFactory: (env) => getBullMQOptions(env) })`.
- Two sites are genuinely outside the DI graph: the direct
  `new Queue("email-reminder", ...)` and `new Queue("telegram-outbound", ...)`
  calls in `main.ts` bootstrap. Both read the validated env via
  `app.get(ENV_CONFIG)` — the Nest app is already constructed at that point.

`mountBullBoard` needs no change: it obtains its queues via
`_app.get(BullBoardQueues)` and never constructs a connection.

Because `validateEnv()` is idempotent (pure `safeParse`), a site with no DI or
`app` access MAY call it instead; but every site here has one, so injection is
used throughout. Either way the helper's input is a validated `EnvConfig`,
never raw `process.env`.

## Before / After

Config flow for the Redis host/port:

- **Before:** five call sites → `requireEnv(process.env, "REDIS_HOST")` +
  `Number(requireEnv(process.env, "REDIS_PORT"))` (raw env, coerced ad hoc, five
  copies).
- **After:** `ENV_CONFIG` (validated) → `buildRedisConnectionOptions(env)` →
  spread into each `new Redis(...)` / BullMQ connection (one seam, typed, no
  coercion, no fallback).

## Risks / Trade-offs

- **Invariants:** untouched — period dual-state, role-coverage gate,
  destructive-db guard, deferred-feature pattern. The role-coverage gate does
  not apply (no tRPC procedure changes).
- **`forRootAsync` migration risk:** switching `BullModule.forRoot` to
  `forRootAsync` changes module init timing slightly. Mitigate by verifying the
  queues register and the worker boots via `pnpm test` + a source boot; the
  connection values are identical, so only wiring, not behavior, moves.
- **Double validation:** the schema is already parsed twice — once by the boot
  fence in `main.ts` and once by the `ENV_CONFIG` provider factory
  (`useFactory: validateEnv`). This change adds no new parse: every site injects
  `ENV_CONFIG` or reads `app.get(ENV_CONFIG)`, so no consumer calls `validateEnv()`
  directly. The double parse is pre-existing, idempotent, and harmless.
- **Test seam:** only `session-revocation.service.ts` has an optional
  injected-`Redis` constructor (`constructor(redis?: Redis)`); that path is
  unchanged, so its unit tests still pass a fake client. `analytics.cache.ts`
  and `telemetry.cache.ts` have a parameterless `constructor()` that builds the
  client inline — each simply gains an `ENV_CONFIG` injection. The analytics
  test fakes the period port in memory and never touches the cache's Redis;
  telemetry has no cache test.
- **MVP note:** no schema or DB migration; API config + DI wiring only.
