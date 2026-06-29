## ADDED Requirements

### Requirement: Production boot MUST require SMTP_HOST and SMTP_FROM

The API env schema (`apps/api/src/infrastructure/config/env.schema.ts`) MUST
fail validation when `NODE_ENV=production` and either `SMTP_HOST` or `SMTP_FROM`
is absent or empty, so a misconfigured production instance cannot boot and
silently drop email. The fence MUST live in the existing production
`superRefine` block and MUST NOT affect `development` or `test` environments,
where both variables remain optional.

#### Scenario: Production boot fails when SMTP_HOST is missing

- **WHEN** `validateEnv()` runs with `NODE_ENV=production`, `SMTP_FROM` set, and
  `SMTP_HOST` unset
- **THEN** validation fails with a `superRefine` issue on path `SMTP_HOST`
- **AND** `validateEnv()` calls `process.exit(1)` rather than returning a config

#### Scenario: Production boot fails when SMTP_FROM is missing

- **WHEN** `validateEnv()` runs with `NODE_ENV=production`, `SMTP_HOST` set, and
  `SMTP_FROM` unset
- **THEN** validation fails with a `superRefine` issue on path `SMTP_FROM`

#### Scenario: Production boot succeeds when both are set

- **WHEN** `validateEnv()` runs with `NODE_ENV=production` and both `SMTP_HOST`
  and `SMTP_FROM` set to non-empty values
- **THEN** validation passes the SMTP fence and returns a parsed `EnvConfig`

#### Scenario: Non-production environments keep SMTP optional

- **WHEN** `validateEnv()` runs with `NODE_ENV=development` or `NODE_ENV=test`
  and both `SMTP_HOST` and `SMTP_FROM` unset
- **THEN** validation passes (no SMTP fence applies outside production)

### Requirement: PDF_EXPORT_JWT_SECRET MUST be at least 32 characters

The `PDF_EXPORT_JWT_SECRET` field in the API env schema MUST enforce a minimum
length of 32 characters (`.min(32)`), matching the `AUTH_JWT_SECRET` convention,
in every environment. This floor applies independently of `NODE_ENV` and is
distinct from the existing production-only check that rejects the default dev
value.

#### Scenario: A short secret is rejected

- **WHEN** `validateEnv()` runs with `PDF_EXPORT_JWT_SECRET` set to a value
  shorter than 32 characters
- **THEN** validation fails with a min-length issue on path
  `PDF_EXPORT_JWT_SECRET`

#### Scenario: A 32-plus-character secret is accepted

- **WHEN** `validateEnv()` runs with `PDF_EXPORT_JWT_SECRET` set to a value of at
  least 32 characters
- **THEN** the field passes its length check

### Requirement: PDF export token guards MUST enforce the 32-character secret floor

The runtime PDF export token signer and verifier MUST reject a
`PDF_EXPORT_JWT_SECRET` shorter than 32 characters, matching the env-schema
floor, and their error messages MUST state the 32-character minimum. This
applies to `signPdfExportToken` and `verifyPdfExportToken` in
`apps/api/src/modules/pdf-export/pdf-export.service.ts`. It keeps the runtime
guard, the schema floor, and the deployment contract on one number rather than
leaving a stale 16-character path callable from tests and direct callers.

#### Scenario: Signer rejects a sub-32-character secret

- **WHEN** `signPdfExportToken` runs with `PDF_EXPORT_JWT_SECRET` set to a value
  shorter than 32 characters
- **THEN** it throws an error whose message states the 32-character minimum
- **AND** no token is produced

#### Scenario: Verifier rejects a sub-32-character secret

- **WHEN** `verifyPdfExportToken` runs with `PDF_EXPORT_JWT_SECRET` set to a
  value shorter than 32 characters
- **THEN** it throws an error whose message states the 32-character minimum
