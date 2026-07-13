## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

`env.schema.ts`'s production `superRefine` enforces `AUTH_DEV_MODE` and SMTP
but never requires the four `KEYCLOAK_SAML_*` vars when `AUTH_DEV_MODE=false`
in production. `saml.strategy.ts` only enforces them via `requireEnv` at the
first SAML login (per its own comment), so a bare prod boot without SAML env
succeeds and the deploy looks healthy until the first user tries to log in.
`docker-compose.prod.yml`'s `:?required` shell syntax masks this for the
canonical compose launch path, but any other prod launch (bare `node`, a
different orchestrator) boots clean and fails late.

Separately, three sites already hold an injected/constructor-passed
`EnvConfig` and still bypass it for a raw `process.env` read with a silent
`??` fallback, violating the repo's no-fallback convention
(`CLAUDE.md` § Conventions): `pdf-export.processor.ts` reads
`process.env.PDF_OUTPUT_DIR ?? "./storage/pdfs"` even though `PDF_OUTPUT_DIR`
is REQUIRED in the schema, so an unset value silently writes PDFs to a
directory the `/pdfs` static mount doesn't serve instead of failing loud;
`prisma.service.ts` reads `process.env.LOG_LEVEL ?? "info"` despite already
receiving `env: EnvConfig` in its constructor; `bullmq-options.ts` reads
`process.env.BULLMQ_PREFIX` raw despite already taking `env: EnvConfig` as a
parameter. All three are exactly the set the `env-schema-coverage` spec's
"Routed vars" requirement named as deferred: "swept together by the separate
follow-up that routes the remaining already-declared raw reads (...
`PDF_OUTPUT_DIR`, `BULLMQ_PREFIX`) — out of scope here." `LOG_LEVEL` is in
that same deferred list. This change is that follow-up.

## What Changes

- `apps/api/src/infrastructure/config/env.schema.ts`: add a production
  `superRefine` branch — when `NODE_ENV === "production"` and
  `AUTH_DEV_MODE` is `false`, require all four `KEYCLOAK_SAML_CALLBACK_URL` /
  `KEYCLOAK_SAML_ENTRY_POINT` / `KEYCLOAK_SAML_ISSUER` / `KEYCLOAK_SAML_CERT`
  to be present and non-blank, mirroring the existing `SMTP_HOST`/`SMTP_FROM`
  fence in the same block. Boot fails loud with a named issue per missing
  var instead of a clean boot and a late SAML-login failure.
- `apps/api/src/infrastructure/bullmq/raw-bullmq-processor.ts`: widen the
  constructor-property `env: EnvConfig` from `private` to `protected` so
  `PdfExportProcessor` (and any future subclass) can read it.
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`: replace
  `resolve(process.env.PDF_OUTPUT_DIR ?? "./storage/pdfs")` with
  `resolve(this.env.PDF_OUTPUT_DIR)` — `PDF_OUTPUT_DIR` is already REQUIRED
  in the schema, so the `??` fallback was unreachable dead-letter cover for a
  boot-time failure that should already have happened.
- `apps/api/src/infrastructure/prisma/prisma.service.ts`: replace
  `(process.env.LOG_LEVEL ?? "info") === "debug"` with
  `this.env.LOG_LEVEL === "debug"`, reading the constructor-injected `env`
  field already stored on the service instead of a fresh raw read.
- `apps/api/src/infrastructure/bullmq/bullmq-options.ts`: replace
  `process.env.BULLMQ_PREFIX?.trim()` with `env.BULLMQ_PREFIX?.trim()` in
  `getBullMQConnectionOptions`, using the `env: EnvConfig` parameter the
  function already receives instead of a fresh raw read.
- `openspec/specs/env-schema-coverage/spec.md`: MODIFY the "Routed vars read
  through the validated config except at named boundaries" requirement to
  move `LOG_LEVEL`, `PDF_OUTPUT_DIR`, and `BULLMQ_PREFIX` from the deferred
  raw-boundary list into the routed set; ADD a new requirement that
  production boot requires the four `KEYCLOAK_SAML_*` vars when
  `AUTH_DEV_MODE` is `false`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `env-schema-coverage`: adds the production SAML-config boot fence and
  closes the `LOG_LEVEL`/`PDF_OUTPUT_DIR`/`BULLMQ_PREFIX` routing follow-up
  the spec already named as deferred.

## Impact

- `apps/api/src/infrastructure/config/env.schema.ts`
- `apps/api/src/infrastructure/bullmq/raw-bullmq-processor.ts`
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
- `apps/api/src/infrastructure/prisma/prisma.service.ts`
- `apps/api/src/infrastructure/bullmq/bullmq-options.ts`

Non-goals: the `APP_BASE_URL`/`FRONTEND_URL`/`PDF_BASE_URL` non-localhost/https
production fence flagged in the same finding is not added here — softening
the comment vs. adding a `superRefine` fence is a product call, out of scope
for this sweep. `AUTH_DEV_MODE_ALLOW_TEST` stays raw per the existing spec
rationale (routing one of the three `NODE_ENV`/`AUTH_DEV_MODE`-adjacent
dev-mode-gate reads buys no safety once declared) — unchanged by this
change. No new env var is introduced; the four `KEYCLOAK_SAML_*` vars stay
`.optional()` in the object shape (dev-login boots without them) — the new
fence lives entirely in `superRefine`, matching the existing SMTP pattern.
