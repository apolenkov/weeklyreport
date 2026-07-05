## Why

Env vars the API consumes are never declared in `envSchema`, so a typo or
missing value in them surfaces late — at first read, deep in a request or a
worker job — instead of loud at boot. `grep process.env` over `apps/api/src`
finds `SENTRY_DSN`, `CLIENT_LOG_FORWARDING`, `AUTH_DEV_MODE_ALLOW_TEST`,
`CUSTOMREPORT_REPO_ROOT`, `TG_BOT_TOKEN`, and `DLQ_ALERT_THRESHOLD` read raw,
outside the one validated schema. A by-hand audit of the sanctioned
`process.env`-consuming factories surfaces a seventh — `AUTH_JWT_COOKIE_NAME`,
read as `env.AUTH_JWT_COOKIE_NAME` inside `resolveSessionCookieName` and thus
invisible to the literal-`process.env` grep. This is Roadmap #5 and a direct
application of the exemplary-code-standard §1.1 no-fallback / explicit-config
rule.

## What Changes

- Declare all seven consumed-but-undeclared env vars in
  `apps/api/src/infrastructure/config/env.schema.ts`, each mapped to the
  existing precedent for its shape (all seven are genuinely optional — no
  `.default()`, `.optional()` per the schema's own posture).
- Route the four vars that have a single reachable validated view through the
  validated config: `CLIENT_LOG_FORWARDING` (the `main.ts` local `env`),
  `DLQ_ALERT_THRESHOLD` (injected `ENV_CONFIG`), and `TG_BOT_TOKEN` +
  `CUSTOMREPORT_REPO_ROOT` (an `EnvConfig` threaded onto the tRPC router deps).
- Leave the sanctioned raw-`process.env` boundaries raw: the schema entry point,
  the `main.ts` `Sentry.init` module-load read (runs before `validateEnv()`),
  the `worker-observability` second process, and the `requireEnv`/factory-env
  factories (`resolveSessionCookieName` carries `AUTH_JWT_COOKIE_NAME`).
  `AUTH_DEV_MODE_ALLOW_TEST` is declared for coverage but read raw beside its
  already-declared `NODE_ENV`/`AUTH_DEV_MODE` dev-mode-gate siblings; those and
  the other already-declared raw reads are a separate follow-up sweep.
- Add an `isTelegramConfigured(env: EnvConfig): boolean` helper in `lib/env.ts`
  beside `requireEnv`, so the two `TG_BOT_TOKEN?.trim()` sites collapse to one
  predicate.

## Capabilities

### New Capabilities

- `env-schema-coverage`: every env var the API consumes is declared in the
  validated `envSchema`; the four vars with a reachable validated view read
  through the validated config; the remaining reads stay at an enumerated set of
  pre-DI / factory-env boundaries; boot fails loud on a missing _required_ var.

### Modified Capabilities

<!-- None. This cross-links exemplary §1.1 and lint-max-strictness-standard
     (eslint strictness), but changes no existing requirement. -->

## Impact

- `apps/api/src/infrastructure/config/env.schema.ts` (7 new declarations).
- `apps/api/src/lib/env.ts` (new `isTelegramConfigured` helper).
- Read sites: `main.ts`, `trpc.router.ts`, `telegram.module.ts`,
  `dlq-monitor.service.ts` (routed); `trpc.context.ts` (declared, raw kept).
- `.env.example`, every `docker-compose*.yml`, e2e env: document the seven vars
  (all optional — no new _required_ value, so no environment must change to boot).

## Non-goals

- Not routing the already-declared raw reads (`LOG_LEVEL`, `LOG_DIR`, `NODE_ENV`,
  `AUTH_DEV_MODE`, `PDF_EXPORT_JWT_SECRET`, `PDF_OUTPUT_DIR`, `BULLMQ_PREFIX`) —
  those are a separate follow-up routing sweep, out of scope.
- Not touching `test-utils/*` env shims.
- Not making any currently-optional toggle required — no-default ≠ all-required.
- Not restating the no-fallback rule; it lives in exemplary §1.1.
