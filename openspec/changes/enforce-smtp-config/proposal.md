## Why

In production, a missing `SMTP_HOST` makes `EmailService` silently fall back to
nodemailer `jsonTransport`, which never delivers — every deadline reminder and
notification is dropped with no error, no failed boot, and no metric. The env
schema's production `superRefine` block fences `AUTH_DEV_MODE`,
`FRONTEND_URLS`, and the PDF secret default, but never `SMTP_HOST`, so a
misconfigured prod instance passes validation and boots clean. Separately,
`EmailService` reads `process.env.SMTP_FROM` / `SMTP_PORT` directly instead of
the validated `EnvConfig`, creating two sources of truth and forcing tests to
mutate `process.env`. The `PDF_EXPORT_JWT_SECRET` floor is `.min(16)` while the
project convention (e.g. `AUTH_JWT_SECRET`) is `.min(32)`.

## What Changes

- Add an `SMTP_HOST` + `SMTP_FROM` fence to the production `superRefine` block
  in `apps/api/src/infrastructure/config/env.schema.ts`: boot MUST fail when
  either is absent and `NODE_ENV=production`.
- Raise the `PDF_EXPORT_JWT_SECRET` floor from `.min(16)` to `.min(32)`.
- Inject the validated `EnvConfig` into `EmailService` via a Nest DI provider
  (`useFactory: validateEnv`), and replace the direct `process.env` reads
  (`SMTP_FROM`, `SMTP_PORT`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) with the
  injected config — one source of truth.
- Keep the existing transport-selection behavior (real SMTP when a host is
  configured, `jsonTransport` otherwise) but drive it from the injected config;
  the new production fence guarantees `jsonTransport` can never be selected in
  production.

## Capabilities

### New Capabilities

- `env-config-validation`: production boot-time fences and field-strength floors
  in the API env schema — production requires `SMTP_HOST` and `SMTP_FROM`, and
  `PDF_EXPORT_JWT_SECRET` requires at least 32 characters.
- `email-delivery-config`: `EmailService` resolves all SMTP configuration from
  the injected validated `EnvConfig` (single source of truth) and selects its
  nodemailer transport from that config.

### Modified Capabilities

<!-- None — no existing spec governs env fences or email delivery config. -->

## Impact

- `apps/api/src/infrastructure/config/env.schema.ts` — production `superRefine`
  gains the SMTP fence; `PDF_EXPORT_JWT_SECRET` floor raised to `.min(32)`.
- `apps/api/src/infrastructure/email/email.service.ts` — constructor takes an
  injected `EnvConfig` instead of reading `process.env`.
- `apps/api/src/app.module.ts` (or a small config module) — new DI provider that
  exposes the validated `EnvConfig` under a token.
- `apps/api/src/infrastructure/email/email-dispatch.integration.test.ts` — tests
  provide `EnvConfig` via DI rather than mutating `process.env`.
- Operational: a prod instance with absent `SMTP_HOST`/`SMTP_FROM` now fails to
  boot loudly instead of dropping all mail silently. Deployment env files must
  set both before the next prod boot.
