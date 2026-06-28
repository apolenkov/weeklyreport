## Context

`PrismaService` (`apps/api/src/infrastructure/prisma/prisma.service.ts`)
creates a `pg.Pool` and passes it to `PrismaPg` (the Prisma driver adapter).
The current code stores the pool reference for shutdown (`pool.end()`) but
never attaches an `error` event listener. The `pg` library documents that
any pool with an idle client that encounters a backend connection drop
emits an `error` event; without a listener this propagates as an
uncaught-exception and can crash the API process.

The pool is also created with only `{ connectionString }`, leaving `max`,
`idleTimeoutMillis`, and `connectionTimeoutMillis` at `pg` defaults
(`max: 10`, `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 0`).
While the defaults are sane, they cannot be adjusted per environment
without a code change — a tuning concern for production sizing.

## Goals / Non-Goals

**Goals**

- Route idle pool errors to the NestJS `Logger` before they become
  process crashes.
- Make pool `max`, `idleTimeoutMillis`, and `connectionTimeoutMillis`
  operator-tunable via env vars.
- Log the resolved pool config at boot so operators can verify the
  active configuration in structured logs.

**Non-Goals**

- Prometheus pool-utilisation gauges (separate change).
- Pool connection retry or circuit-breaker logic.
- Changes to `DATABASE_URL` / `DIRECT_URL` parsing.
- Changes outside `prisma.service.ts` in the api layer.

## Decisions

### D1: Attach `pool.on('error', ...)` in the constructor, not `onModuleInit`

The `pg` library can emit pool `error` events as soon as the pool is
created — before `onModuleInit` fires. Registering the listener in the
constructor guarantees no error is missed during the module-init window.
Alternatives considered:

- Register in `onModuleInit` — would miss the narrow window between
  pool construction and module initialisation.
- Wrap pool creation in a try/catch — does not help because `error` is
  an asynchronous event, not a thrown exception.

### D2: Parse env vars with `parseInt` + fallback, no Zod validation

The three new vars are internal tunables used only by `PrismaService`.
They have safe numeric defaults and never flow into shared schemas.
Using `parseInt` with a fallback constant keeps the constructor zero-dep
on any validation library and avoids coupling to the env-schema module.
Alternatives considered:

- Add vars to the existing env Zod schema — would require modifying
  `env.schema.ts` and wiring `EnvConfig` into `PrismaService` via DI;
  disproportionate for three optional ints with obvious defaults.

### D3: Log resolved pool config alongside "Database connection established"

Emitting one log entry per boot with all three resolved values lets
operators grep a single line to confirm the active pool configuration.
This is a log-level (info) entry, not debug, so it appears in production
without enabling verbose logging.

## Risks / Trade-offs

- [Risk] `pool.on('error', ...)` fires asynchronously; if the API process
  is already inside a fatal error path, the log may not flush.
  → Mitigation: acceptable — the same caveat applies to any async logger;
  the goal is to surface errors under normal runloop conditions, not
  inside a crashing process.

- [Risk] A very high `DB_POOL_MAX` set via env could exhaust PostgreSQL
  `max_connections`.
  → Mitigation: document the env var comments in `.env.example` with the
  advisory to keep the value below the DB server's `max_connections`
  minus connections from other services.

## Migration Plan

1. Edit `prisma.service.ts` — add `pool.on('error', ...)` in the
   constructor; read and apply the three env vars.
2. Update `.env.example` and `.env.test.example` — add commented entries
   for the three vars.
3. Run the full gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

No schema change, no migration, no shared-package change. Rollback is a
single file revert.

## Open Questions

None — the design is fully determined by the failing-process risk and the
env-var convention already used for `DATABASE_URL`.
