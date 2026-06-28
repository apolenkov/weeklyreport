## Context

`EmailService` is a plain Nest provider (`apps/api/src/app.module.ts:77`) whose
constructor reads `process.env.SMTP_*` directly. `validateEnv()` is called once
in `main.ts:102` and its result never enters the DI container — no
`ConfigModule`/`ConfigService` exists. So today:

- A missing `SMTP_HOST` makes the constructor pick `jsonTransport`, which never
  delivers. In production this drops all mail silently.
- The env schema's production `superRefine` fences `AUTH_DEV_MODE`,
  `FRONTEND_URLS`, and the PDF secret default — but not `SMTP_HOST`.
- `EmailService` and `env.schema` disagree on what config exists; tests mutate
  `process.env` to steer the service.

## Goals / Non-Goals

**Goals:**

- Make a misconfigured production instance fail to boot loudly instead of
  dropping mail silently.
- Give `EmailService` a single validated source of truth (`EnvConfig`) via DI.
- Align `PDF_EXPORT_JWT_SECRET` with the project's `.min(32)` secret floor.

**Non-Goals:**

- No runtime send-failure metric or retry. The boot fence makes a misconfigured
  prod unbootable, so a runtime "mail dropped" metric is redundant here.
- No `@nestjs/config` dependency — reuse the repo's existing DI-token idiom.
- No change to the existing `AUTH_DEV_MODE` / `FRONTEND_URLS` / PDF-default
  fences; this change only ADDs the SMTP fence and the JWT floor.
- No change to `sendMail` / `sendMailMultipart` signatures or the per-call
  `from` override (UFB-048).

## Decisions

### 1. Env-schema fences (env.schema.ts)

Inside the existing `if (data.NODE_ENV === "production")` block in
`superRefine`, add issues when `SMTP_HOST` or `SMTP_FROM` is missing/empty
(paths `SMTP_HOST` / `SMTP_FROM`). Raise `PDF_EXPORT_JWT_SECRET` from `.min(16)`
to `.min(32)` on the field itself (always-on, not prod-scoped). The default dev
value (`"dev-only-replace-in-production-min-32-chars"`) is already ≥32 chars, so
the floor does not break dev/test boots.

### 2. EnvConfig as a DI provider

Expose the validated config under a token, following the repo's
token + `useFactory` idiom (telegram adapter, repositories-via-`useFactory`):

```ts
export const ENV_CONFIG = Symbol("ENV_CONFIG");
// provider: { provide: ENV_CONFIG, useFactory: validateEnv }
```

`validateEnv()` is idempotent (pure `safeParse` of `process.env`), so calling it
again inside the factory is safe even though `main.ts` also calls it. The
provider belongs in `app.module.ts` `providers` (or a tiny `ConfigModule` that
exports the token) so any provider — `EmailService` first — can inject it.

**Ordering:** `EmailService` is instantiated during `NestFactory.create`, before
`main.ts` reaches its own `validateEnv()` call. The factory provider validates
at module-construction time, so the fence fires during `NestFactory.create` —
earlier than today's `main.ts` check, which is the desired fail-closed point.

### 3. EmailService consumes EnvConfig

Constructor becomes `constructor(@Inject(ENV_CONFIG) env: EnvConfig)`. Replace
every `process.env.SMTP_*` read with `env.SMTP_*`. The `fromAddress`,
host/port/auth, and `isDev` flag all derive from `env`. Transport-selection
logic is unchanged in shape — only its inputs move from `process.env` to `env`.

## Before / After

Config flow:

- **Before:** `main.ts` → `validateEnv()` (result unused by DI). `EmailService`
  → `process.env` (unvalidated, second source of truth).
- **After:** `ENV_CONFIG` provider → `validateEnv()` → injected into
  `EmailService` (one validated source). Production boot aborts in
  `NestFactory.create` if SMTP env is incomplete.

## Risks / Trade-offs

- **Invariants:** preserves the deferred-feature pattern, period dual-state,
  role-coverage gate, and destructive-db guard (untouched). Tightens the
  production env contract (boot now requires SMTP env).
- **Operational rollout:** the first prod boot after this change requires
  `SMTP_HOST` and `SMTP_FROM` in the deployment env, or boot fails. This is the
  intended fail-closed behavior; document it in the deployment env example.
- **Double validation:** `validateEnv()` runs in both the provider and
  `main.ts`. Harmless (idempotent) and keeps `main.ts` working for non-Nest
  callers; optionally `main.ts` could read the token later, but that is out of
  scope.
- **MVP note:** no schema/DB migration involved; this is API config + DI wiring
  only.
