## 1. API env schema fences

- [ ] 1.1 In `apps/api/src/infrastructure/config/env.schema.ts`, inside the
      existing `NODE_ENV === "production"` block of `superRefine`, add a
      `superRefine` issue on path `SMTP_HOST` when it is absent/empty, and a
      separate issue on path `SMTP_FROM` when it is absent/empty.
- [ ] 1.2 Raise the `PDF_EXPORT_JWT_SECRET` field floor from `.min(16)` to
      `.min(32)` (keep the existing default and the production default-value
      check unchanged).
- [ ] 1.3 Add/extend a unit test for `validateEnv()` covering: prod missing
      `SMTP_HOST` fails, prod missing `SMTP_FROM` fails, prod with both set
      passes the SMTP fence, dev/test with neither set passes, and
      `PDF_EXPORT_JWT_SECRET` shorter than 32 chars fails.
- [ ] 1.4 Raise the runtime guards in
      `apps/api/src/modules/pdf-export/pdf-export.service.ts`
      (`signPdfExportToken` and `verifyPdfExportToken`) from `< 16` to `< 32`,
      update their error messages to state the 32-character minimum, and fix the
      stale `// Min 16 chars enforced in the service.` comment in `env.schema.ts`
      to say 32. Add/extend a unit test asserting both guards reject a sub-32
      secret.

## 2. EnvConfig DI provider

- [ ] 2.1 Add an `ENV_CONFIG` injection token and a provider
      (`{ provide: ENV_CONFIG, useFactory: validateEnv }`) — in `app.module.ts`
      `providers`, or a small dedicated config module that exports the token.
- [ ] 2.2 Ensure the token is resolvable by `EmailService` (same module graph or
      exported from the config module and imported where needed).

## 3. EmailService consumes EnvConfig

- [ ] 3.1 Change `EmailService` constructor to
      `constructor(@Inject(ENV_CONFIG) env: EnvConfig)` and replace every
      `process.env.SMTP_*` read with the injected `env.SMTP_*`.
- [ ] 3.2 Keep transport selection behavior: real SMTP transport when
      `env.SMTP_HOST` is set, `jsonTransport` otherwise; derive `fromAddress`,
      port, and auth from `env`.
- [ ] 3.3 Update `apps/api/src/infrastructure/email/email-dispatch.integration.test.ts`
      to provide `EnvConfig` through the test module provider instead of
      mutating `process.env.SMTP_*`.

## 4. Deployment contract

- [ ] 4.1 Update the `PDF_EXPORT_JWT_SECRET` required-env message in
      `docker-compose.prod.yml` (line ~160) from `min 16 chars` to
      `min 32 chars`, keeping the "NOT the dev fallback" note.
- [ ] 4.2 Sweep any remaining `min 16` / `>= 16` PDF-secret wording in env docs
      and `.env*` examples so every deployment-facing reference says 32.

## 5. Verification

- [ ] 5.1 Run `pnpm typecheck`.
- [ ] 5.2 Run `pnpm lint`.
- [ ] 5.3 Run `pnpm test` (env-schema unit tests + email integration test).
- [ ] 5.4 Run `pnpm build`.
- [ ] 5.5 Run `openspec validate "enforce-smtp-config" --strict` (exit 0).
