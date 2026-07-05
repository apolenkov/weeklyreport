## 1. Declare the seven vars in envSchema

- [x] 1.1 Add `SENTRY_DSN: z.string().optional()` with a WHY comment (error capture; inits only when set — `main.ts`).
- [x] 1.2 Add `TG_BOT_TOKEN: z.string().optional()` (MockTelegramAdapter unless set).
- [x] 1.3 Add `DLQ_ALERT_THRESHOLD: z.coerce.number().int().positive().optional()` mirroring the `DB_POOL_MAX` comment (present ⇒ must parse; absent ⇒ consumer `DEFAULT_THRESHOLD`).
- [x] 1.4 Add `CLIENT_LOG_FORWARDING: z.string().optional()` (prod opt-in toggle; dev enabled via `NODE_ENV`).
- [x] 1.5 Add `AUTH_DEV_MODE_ALLOW_TEST: z.string().optional()` (non-prod test-context toggle).
- [x] 1.6 Add `CUSTOMREPORT_REPO_ROOT: z.string().optional()` (dev/test reseed repo-root override).
- [x] 1.7 Add `AUTH_JWT_COOKIE_NAME: z.string().optional()` (session-cookie name; `resolveSessionCookieName` applies its named `SESSION_COOKIE_DEFAULT_NAME` when absent).
- [x] 1.8 Confirm no `.default()` was introduced anywhere in `env.schema.ts`.

## 2. Add the Telegram predicate + thread EnvConfig to its call sites

- [x] 2.1 Add `isTelegramConfigured(env: EnvConfig): boolean` to `apps/api/src/lib/env.ts`, keyed on `env.TG_BOT_TOKEN?.trim()` non-empty.
- [x] 2.2 Inject `ENV_CONFIG` into the `TelegramModule` adapter `useFactory` (add it to the provider's `inject` array and pass the `EnvConfig` into `selectTelegramAdapter`); replace the inline `TG_BOT_TOKEN?.trim() ?? ""` check in `telegram.module.ts:26` with `isTelegramConfigured(env)`.
- [x] 2.3 Thread an `EnvConfig` field onto `RouterDeps` and populate it where `createAppRouter(deps)` is wired (the tRPC module); replace the inline check in `trpc.router.ts:1079` (the `integrationsStatus` query) with `isTelegramConfigured(deps.env)`.

## 3. Route the four reachable reads through the validated config

- [x] 3.1 In `dlq-monitor.service.ts`, inject `ENV_CONFIG` (`@Inject(ENV_CONFIG)`, modelled on `prisma.service.ts`) and read the threshold as `env.DLQ_ALERT_THRESHOLD ?? DEFAULT_THRESHOLD`. Drop the `parseThreshold` `Number(...)` parse and the invalid-value warning entirely — the schema's `z.coerce.number()` makes the injected value `number | undefined`, so the `Number.isFinite`/warn branch is unreachable dead code (verify task 5.2 asserts boot-fail now replaces that warning).
  - NOTE: `EnvConfig` was ALREADY injected via the module `useFactory` (`bullmq.module.ts` `useFactory: (env) => new DLQMonitorService(env)`, `inject: [ENV_CONFIG]`) — no `@Inject` decorator change needed. Only the read was swapped and `parseThreshold` + its 3 seam tests removed.
- [x] 3.2 In `main.ts`, read `CLIENT_LOG_FORWARDING` from the local validated `env` (`env.CLIENT_LOG_FORWARDING === "true"`), reusing the `const env = validateEnv()` already in scope at the same expression as `env.NODE_ENV`.
- [x] 3.3 In `trpc.router.ts:469`, read `CUSTOMREPORT_REPO_ROOT` from the `EnvConfig` threaded onto `RouterDeps` in task 2.3, not raw `process.env`.
- [x] 3.4 Leave the sanctioned raw boundaries raw — do NOT rewire: `env.schema.ts` `safeParse`; `main.ts:11-13` `Sentry.init` (module load, before `validateEnv()`); `worker-observability.ts` `validateEnv`; the `requireEnv`/named-default factories (`createAuthController`, `createSamlStrategyOptions`, `otel.bootstrap`, `resolveSessionCookieName` — the last carrying `AUTH_JWT_COOKIE_NAME`).
- [x] 3.5 Leave `AUTH_DEV_MODE_ALLOW_TEST` at `trpc.context.ts:306` raw — it is declared for coverage (task 1.5) but co-located with its already-declared `NODE_ENV`/`AUTH_DEV_MODE` dev-mode-gate siblings (303-304), which the separate follow-up sweep routes together. The context factory holds no `EnvConfig` today.

## 4. Document the vars per environment (non-normative impl hygiene)

> Section 4 traces to no spec scenario — it is documentation hygiene, not a
> verifiable behavioural requirement. Coverage/routing are proven by section 5.

- [x] 4.1 Add the seven vars (all optional, commented) to `.env.example`.
- [x] 4.2 Add/annotate them in every `docker-compose*.yml` that runs the API.
- [x] 4.3 Add them to the e2e webServer env if any e2e path exercises them.

## 5. Verify

- [x] 5.1 Coverage grep: a literal `process.env.<NAME>` scan of `apps/api/src` (excluding `*.spec.ts`, `*.test.ts`, `test-utils/*`) surfaces zero keys absent from `envSchema`; separately hand-audit the sanctioned factory-env factories (`resolveSessionCookieName` et al.) for any `env.<NAME>` read absent from `envSchema`.
- [x] 5.2 Boot the API with a malformed `DLQ_ALERT_THRESHOLD` (e.g. `"10junk"`) and confirm it fails loud at startup via `validateEnv()`, not at the first DLQ poll — replacing the former parse-and-warn degrade.
- [x] 5.3 Gate green: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`.
  - NOTE: gated api-scope (db:generate ok; `tsc -p apps/api` clean; eslint `--max-warnings 0` clean on all changed files; api vitest 1393 pass / 124 files; integration 258 pass / 37 files). Full repo `pnpm test` is red in WEB only (parallel session's WIP components) — unrelated to this change's api-only scope.
- [x] 5.4 `openspec validate "complete-env-schema-coverage" --strict` prints "is valid".
