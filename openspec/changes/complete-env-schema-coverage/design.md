## Context

`envSchema` (`apps/api/src/infrastructure/config/env.schema.ts`) is the one
validated view of the environment; `ConfigModule` runs `validateEnv()` in a
`useFactory` at boot and exposes the result under the `ENV_CONFIG` Symbol. Its
own header comment already codifies the no-fallback posture (exemplary §1.1):
required vars have no default and fail boot loud; genuinely-optional features
stay `.optional()` with the consumer handling absence.

Seven consumed vars never reached that schema. A `grep process.env apps/api/src`
(excluding tests / `test-utils`) surfaces six read raw; a hand-audit of the
sanctioned factory-env factories surfaces the seventh (`AUTH_JWT_COOKIE_NAME`,
invisible to the literal grep):

| Var                        | Sites                                                                | Read shape                          |
| -------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| `SENTRY_DSN`               | `main.ts:11,13`                                                      | `if (process.env.SENTRY_DSN)`       |
| `CLIENT_LOG_FORWARDING`    | `main.ts:280`                                                        | `=== "true"` toggle                 |
| `AUTH_DEV_MODE_ALLOW_TEST` | `trpc.context.ts:306`                                                | `=== "true"` toggle                 |
| `CUSTOMREPORT_REPO_ROOT`   | `trpc.router.ts:469`                                                 | first candidate in a repo-root list |
| `TG_BOT_TOKEN`             | `trpc.router.ts:1079` (integrationsStatus), `telegram.module.ts:26`  | `?.trim() ?? ""`                    |
| `DLQ_ALERT_THRESHOLD`      | `dlq-monitor.service.ts:95`                                          | `Number(raw)`, consumer default     |
| `AUTH_JWT_COOKIE_NAME`     | `session-cookie.ts:12` via `resolveSessionCookieName` (5 call sites) | `env.X ?? DEFAULT`, factory-env     |

## Goals / Non-Goals

**Goals:**

- Declare all seven in `envSchema` so config errors fail at one parse, not late.
- Route the four vars with a reachable validated view through that view.
- Collapse the two `TG_BOT_TOKEN` checks into one `isTelegramConfigured` helper.

**Non-Goals:**

- Not making any of the seven required — no-default ≠ all-required (see below).
- Not routing the seven already-declared raw reads (`LOG_LEVEL`, `LOG_DIR`,
  `NODE_ENV`, `AUTH_DEV_MODE`, `PDF_EXPORT_JWT_SECRET`, `PDF_OUTPUT_DIR`,
  `BULLMQ_PREFIX`) — separate follow-up sweep.
- Not touching `test-utils/*` env shims.
- Not eliminating sanctioned pre-DI / factory-env raw `process.env` boundaries.

## Decisions

**D1 — New capability, not a MODIFIED config spec.** No `config` capability
exists in `openspec/specs/`; `schema-conventions` covers Zod validator style,
`lint-max-strictness-standard` covers eslint strictness. A new
`env-schema-coverage` capability avoids MODIFIED-header collision (in-flight
`centralize-redis-connection-config` / `centralize-web-api-url` own different
capabilities) and cross-links §1.1 rather than restating it.

**D2 — All seven are `.optional()`, none required.** The no-default rule forbids
`.default()`, not optionality. Requiring a dev/test toggle would force every
`.env`, `docker-compose*.yml`, and the e2e env to set it — real migration cost
for zero safety gain. Each maps to an existing precedent:

- `SENTRY_DSN`, `TG_BOT_TOKEN` → optional string (`OTEL_EXPORTER_OTLP_ENDPOINT`);
  the feature starts only when the value is present.
- `DLQ_ALERT_THRESHOLD` → `z.coerce.number()…optional()` (`DB_POOL_MAX`); a
  present value must parse to a finite number or fail boot; absent → consumer's
  named `DEFAULT_THRESHOLD` const (no `.default()` in the schema).
- `CLIENT_LOG_FORWARDING`, `AUTH_DEV_MODE_ALLOW_TEST` → optional string toggles;
  dev enables client-log via `NODE_ENV`, prod opts in explicitly.
- `CUSTOMREPORT_REPO_ROOT` → optional string override; dev/test reseed only,
  already the first of several fallback candidates.
- `AUTH_JWT_COOKIE_NAME` → optional string; `resolveSessionCookieName` applies
  its named `SESSION_COOKIE_DEFAULT_NAME` const when absent (a named consumer
  default, matching the D2 pattern — no `.default()` in the schema).

**D3 — `requireEnv` ≠ schema-required.** Schema-declared REQUIRED → validated at
boot by `ConfigModule` → fails loud at startup. `requireEnv(env, "X")` is a bare
presence check that throws at first _read_ (lazy, possibly post-boot). So
"boot-fail-loud" is satisfied by declaring a var REQUIRED in the schema, not by
reading it via `requireEnv`. The seven added vars are optional, so neither fence
applies to them; this distinction is recorded so a future required var is put in
the schema, not left to a lazy `requireEnv`.

**D4 — Routed set vs sanctioned raw boundaries.** "Route ALL reads through
ENV_CONFIG" is false for legitimate pre-DI / factory-env sites. This change
routes exactly the four vars that have a single reachable validated view:

- `CLIENT_LOG_FORWARDING` → the `main.ts` local `env` (`const env =
validateEnv()` at `main.ts:138`; line 279 already reads `env.NODE_ENV` in the
  same expression). The earlier design claim that this "executes before
  ENV_CONFIG exists" was wrong — a validated `env` is in scope, so the read is
  `env.CLIENT_LOG_FORWARDING`. Only `Sentry.init` (`main.ts:11-13`) is genuinely
  module-load, before `validateEnv()`, and stays raw.
- `DLQ_ALERT_THRESHOLD` → `dlq-monitor.service.ts` injects `ENV_CONFIG`
  (`@Inject(ENV_CONFIG)`), modelled on `prisma.service.ts`.
- `TG_BOT_TOKEN` + `CUSTOMREPORT_REPO_ROOT` → the tRPC router, once an
  `EnvConfig` is threaded onto `RouterDeps` (the router currently holds zero
  `EnvConfig`; threading it is a prerequisite for `isTelegramConfigured` at
  `trpc.router.ts:1079` and reused for the repo-root read at `469`).

Sanctioned raw boundaries (unchanged): the `envSchema.safeParse(process.env)`
entry point; `Sentry.init` at `main.ts` module load; the second `validateEnv()`
in `worker-observability.ts` (separate BullMQ worker process); factory functions
with `env: NodeJS.ProcessEnv = process.env` that read via `requireEnv` or a
named default (`createAuthController`, `createSamlStrategyOptions`,
`otel.bootstrap`, `resolveSessionCookieName` — the last carrying
`AUTH_JWT_COOKIE_NAME`). Callers passing `process.env` into those factories are
already the sanctioned pattern.

`AUTH_DEV_MODE_ALLOW_TEST` (`trpc.context.ts:306`) is declared for coverage but
NOT routed: it sits in the 303-306 dev-mode gate beside `NODE_ENV` and
`AUTH_DEV_MODE` (both already declared, both read raw). Routing one of three
reads is churn for zero safety once the var is declared; all three are swept
together by the separate follow-up that routes the already-declared raw reads.
The context factory holds no `EnvConfig` today, which is why this is deferred
rather than forced.

**D5 — `isTelegramConfigured(env: EnvConfig): boolean` in `lib/env.ts`.** Beside
`requireEnv`, keyed on `env.TG_BOT_TOKEN?.trim()` non-empty. Both the router's
`integrationsStatus` query and `telegram.module` call it; neither re-implements
the trim check. Because neither call site currently has an `EnvConfig`, D4's
router-deps threading and a `useFactory` `ENV_CONFIG` inject in `TelegramModule`
are prerequisites, not incidental.

**D6 — Factory-env coverage blind spot.** The coverage grep matches literal
`process.env.<NAME>`; a var read as `env.<NAME>` off a `process.env` parameter
inside a factory (like `AUTH_JWT_COOKIE_NAME` in `resolveSessionCookieName`) is
invisible to it. The requirement records this: the grep is necessary but not
sufficient, and the sanctioned factory-env factories MUST be audited by hand for
undeclared reads. Declaring `AUTH_JWT_COOKIE_NAME` (the one the audit found) is
the proof; its read stays via the sanctioned `resolveSessionCookieName` factory.

## Risks / Trade-offs

- [Declaring an optional coerced number could reject a value pg previously
  swallowed] → intended: `DLQ_ALERT_THRESHOLD="10junk"` now fails boot loud
  instead of silently degrading; matches the `DB_POOL_MAX` precedent. This
  removes the `parseThreshold` invalid-value warning branch as dead code.
- [Reader assumes new vars are required and over-sets envs] → design + schema
  comment state they are optional; §1.1 no-default is respected without
  forcing new required values, so no environment must change to boot.
- [Sanctioned-boundary list drifts as bootstrap changes] → the list lives in the
  spec's read-routing requirement; a coverage grep flags any new undeclared var,
  a hand-audit covers factory-env reads, and reviewers check new raw reads
  against the enumerated boundaries.

## Migration Plan

1. Add the seven `.optional()` fields to `envSchema` with per-var WHY comments.
2. Add `isTelegramConfigured` to `lib/env.ts`; thread `EnvConfig` onto
   `RouterDeps` and into the `TelegramModule` `useFactory`; point both token
   sites at the helper.
3. Route the four reachable reads: `CLIENT_LOG_FORWARDING` (main.ts local `env`),
   `DLQ_ALERT_THRESHOLD` (injected `ENV_CONFIG`, dropping the parse+warning),
   `TG_BOT_TOKEN` + `CUSTOMREPORT_REPO_ROOT` (threaded `EnvConfig`). Leave the
   enumerated bootstrap/factory sites and the `AUTH_DEV_MODE_ALLOW_TEST`
   dev-mode gate raw.
4. Document the seven (optional) in `.env.example`, every `docker-compose*.yml`,
   and the e2e env — no value is newly required, so no env must change to boot.
5. Gate: `pnpm typecheck && pnpm lint && pnpm test`; the coverage grep reports
   zero undeclared keys. Rollback = revert the schema + read-site diff (no data,
   no migration touched).

## Open Questions

None. Var-by-var classification (D2), the routed-vs-sanctioned split (D4), and
the factory-env blind spot (D6) are settled against the current code.
