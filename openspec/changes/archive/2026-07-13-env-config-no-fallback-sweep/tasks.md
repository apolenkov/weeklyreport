## 1. Production SAML-config boot fence (CN-05)

- [ ] 1.1 `env.schema.ts`: in the existing production `superRefine` block,
      add a branch — when `data.NODE_ENV === "production" &&
!data.AUTH_DEV_MODE` — that adds an issue for each of
      `KEYCLOAK_SAML_CALLBACK_URL`, `KEYCLOAK_SAML_ENTRY_POINT`,
      `KEYCLOAK_SAML_ISSUER`, `KEYCLOAK_SAML_CERT` that is absent or
      blank (`?.trim()` empty), one `ctx.addIssue` per missing var with its
      own `path`, mirroring the `SMTP_HOST`/`SMTP_FROM` branch already in
      the block
- [ ] 1.2 Confirm `docker-compose.prod.yml`'s `:?required` shell syntax
      still supplies all four vars for the canonical compose launch (no
      compose file change expected — this fence covers the non-compose
      launch path the shell guard can't reach)

## 2. Route PDF_OUTPUT_DIR through EnvConfig

- [ ] 2.1 `raw-bullmq-processor.ts`: widen the constructor-property
      `env: EnvConfig` from `private` to `protected`
- [ ] 2.2 `pdf-export.processor.ts`: replace
      `resolve(process.env.PDF_OUTPUT_DIR ?? "./storage/pdfs")` with
      `resolve(this.env.PDF_OUTPUT_DIR)`; drop the now-unreachable fallback
      string

## 3. Route LOG_LEVEL through EnvConfig

- [ ] 3.1 `prisma.service.ts`: replace
      `(process.env.LOG_LEVEL ?? "info") === "debug"` with
      `this.env.LOG_LEVEL === "debug"`, reading the `env` field the
      constructor already stores

## 4. Route BULLMQ_PREFIX through EnvConfig

- [ ] 4.1 `bullmq-options.ts`: in `getBullMQConnectionOptions`, replace
      `process.env.BULLMQ_PREFIX?.trim()` with `env.BULLMQ_PREFIX?.trim()`,
      using the function's existing `env: EnvConfig` parameter

## 5. Spec delta

- [ ] 5.1 `env-schema-coverage`: MODIFY the "Routed vars read through the
      validated config except at named boundaries" requirement — move
      `LOG_LEVEL`, `PDF_OUTPUT_DIR`, `BULLMQ_PREFIX` from the deferred
      raw-boundary list into the routed set
- [ ] 5.2 `env-schema-coverage`: ADD a requirement that production boot
      requires the four `KEYCLOAK_SAML_*` vars when `AUTH_DEV_MODE` is false

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 Fail-injection check: with `NODE_ENV=production`,
      `AUTH_DEV_MODE=false`, and `KEYCLOAK_SAML_ISSUER` unset, `validateEnv()`
      exits non-zero naming the missing var; with all four SAML vars set it
      boots clean
- [ ] 6.4 Fail-injection check: unset `PDF_OUTPUT_DIR` in a non-prod env and
      confirm boot fails at `validateEnv()` (the field is REQUIRED), not
      later inside `PdfExportProcessor`
- [ ] 6.5 Live-check: run a PDF export job and confirm the file lands under
      the configured `PDF_OUTPUT_DIR` and is served by the `/pdfs` static
      mount
- [ ] 6.6 `grep -n "process.env.PDF_OUTPUT_DIR\|process.env.LOG_LEVEL\|process.env.BULLMQ_PREFIX" apps/api/src -r` returns zero hits outside `env.schema.ts`, the sanctioned pre-DI boundary `lib/logger-service.ts` (zod-parsed, throws on invalid), and the test harness `test-utils/test-env.setup.ts`
- [ ] 6.7 `npx openspec validate env-config-no-fallback-sweep --strict`
- [ ] 6.8 Adversarial review of the diff before archiving
