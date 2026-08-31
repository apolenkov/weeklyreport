# web-env-validation Specification

## Purpose

Declare every consumed public web variable in one no-default schema, fail builds on invalid values, and route reads through a typed inlining-safe accessor.

## Requirements

### Requirement: Client env is declared in one Zod schema with no default

The web app MUST declare every `NEXT_PUBLIC_*` variable it consumes (outside the
API URL seam) in a single Zod schema, and that schema MUST NOT
attach a `.default()` to any field — a genuinely-optional toggle is declared
`.optional()` with the consumer handling absence, mirroring the api
`env-schema-coverage` no-default posture. The in-scope set is exactly six:
`NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_AUTH_STUB`,
`NEXT_PUBLIC_CLIENT_LOG_FORWARDING`, `NEXT_PUBLIC_DEV_ROLE_SWITCHER`,
`NEXT_PUBLIC_SENTRY_DSN`, and `NEXT_PUBLIC_WEB_VITALS`. Each field MUST carry
meaningful validation, not a
blanket permissive string: `NEXT_PUBLIC_SENTRY_DSN` is a URL-or-unset; the
boolean toggles (`AUTH_STUB`, `CLIENT_LOG_FORWARDING`, `DEV_ROLE_SWITCHER`,
`WEB_VITALS`) accept only `"true"`, `"false"`, or unset so a
typo is rejected rather than read as "off"; `NEXT_PUBLIC_APP_VERSION` is an
optional string. Empty string MUST count as unset WITHIN the schema itself (a
per-field `""`→`undefined` preprocess), so that BOTH the build assert and the
accessor — the two parse sites sharing this schema — treat an empty value as
absent rather than one of them feeding `""` into `z.url()`.

#### Scenario: Every consumed client var is declared

- **GIVEN** a `NEXT_PUBLIC_*` var such as `NEXT_PUBLIC_WEB_VITALS` is read in
  `apps/web/src` outside test code and outside the API URL seam
- **WHEN** the client-env schema object shape is inspected
- **THEN** the key is present with a non-permissive Zod type
- **AND** no field in the schema carries a `.default()`

#### Scenario: A malformed toggle value is a type error, not a silent off

- **GIVEN** `NEXT_PUBLIC_DEV_ROLE_SWITCHER=ture` (a typo, not `true`)
- **WHEN** the value is parsed against its schema field
- **THEN** the parse fails because the field admits only `"true"`, `"false"`, or
  unset, rather than coercing the typo to a disabled feature

### Requirement: A build-time assert fails the build on malformed client env

The web app MUST parse the client-env schema at `apps/web/next.config.ts`
load time — which executes during `next build`, where the real `NEXT_PUBLIC_*`
values are present in `process.env` before inlining — and MUST throw a
descriptive error that fails the build when any value is malformed. This is a
completeness-and-typing gate, not a required-presence gate: all six vars are
optional, so absence is allowed and only a PRESENT-but-malformed value (e.g. a
non-URL DSN) rejects the build.

#### Scenario: Malformed DSN rejects the build

- **GIVEN** `NEXT_PUBLIC_SENTRY_DSN=not-a-url` is set at build time
- **WHEN** `next.config.ts` runs the client-env assert during `next build`
- **THEN** the build throws a descriptive error naming the offending variable
  and does not produce a bundle

#### Scenario: All-absent env builds clean

- **GIVEN** none of the six in-scope vars are set at build time
- **WHEN** `next.config.ts` runs the client-env assert
- **THEN** the assert passes because every field is optional and the build
  proceeds

#### Scenario: Empty-string DSN passes the build assert

- **GIVEN** `NEXT_PUBLIC_SENTRY_DSN=""` at build time (as `docker-compose.dev.yml`
  supplies via `${NEXT_PUBLIC_SENTRY_DSN:-}` when the host value is unset)
- **WHEN** `next.config.ts` runs the client-env assert during `next build`
- **THEN** the assert passes because the schema's `""`→unset preprocess maps the
  empty string to absent before `z.url()` runs, rather than rejecting it and
  breaking the docker dev build

### Requirement: A typed accessor is the single client-env read seam and preserves inlining

The web app MUST read the six in-scope client vars through one typed accessor
module (a `web-env` seam sibling to `requireApiUrl` in
`apps/web/src/shared/server/transport/api-url.ts`) rather than reaching for raw
`process.env`. Because Next replaces each `process.env.NEXT_PUBLIC_X` occurrence
with a string literal at build time, the accessor MUST build an explicit object
literal of full literal references
(`{ NEXT_PUBLIC_AUTH_STUB: process.env.NEXT_PUBLIC_AUTH_STUB, … }`) and parse
THAT object through the shared schema; it MUST NOT call
`schema.parse(process.env)` and MUST NOT destructure or dynamically index
`process.env[key]`, because any of those defeats inlining and yields empty
values in the browser bundle. Empty string counts as unset via the schema's own
per-field preprocess (Requirement 1), so the accessor needs no separate
`nonEmpty` coercion. The accessor MUST parse LAZILY at getter call time, not
eagerly at module scope, so a value read is not frozen at first import — the
existing suite mutates `process.env.NEXT_PUBLIC_*` after import
(`role-switcher.test.tsx`, `login-page.client.test.tsx`, `page.test.tsx`), and an
eager module-scope parse would break it. The accessor MUST expose typed derived
getters — the four boolean toggles resolved to `boolean` (so the scattered
`=== "true"` comparisons live in one place), plus `appVersion` and `sentryDsn`.
Two toggle getters MUST fold the existing `NODE_ENV !== "production"` guard to
match current code: `NEXT_PUBLIC_AUTH_STUB` (as `login-page.client.tsx` does) AND
`NEXT_PUBLIC_DEV_ROLE_SWITCHER` (as BOTH `nav-right-rail.tsx` and
`role-switcher.tsx`
do) — dropping the latter's guard would render the dev role switcher in a
production build where `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`.

#### Scenario: Accessor references full literals so values survive inlining

- **GIVEN** the accessor resolves `NEXT_PUBLIC_WEB_VITALS`
- **WHEN** it reads the value
- **THEN** it references the full literal `process.env.NEXT_PUBLIC_WEB_VITALS`
  inside an explicit object passed to the schema, not `process.env[name]` nor a
  destructured/spread `process.env`

#### Scenario: Empty string is treated as unset

- **GIVEN** `NEXT_PUBLIC_APP_VERSION=""` after inlining
- **WHEN** a consumer reads `appVersion` from the accessor
- **THEN** it observes an absent value (undefined), not an empty string, so the
  login footer renders no version suffix

#### Scenario: The auth-stub getter folds the production guard

- **GIVEN** `NEXT_PUBLIC_AUTH_STUB=true` and `NODE_ENV=production`
- **WHEN** a consumer reads the auth-stub getter
- **THEN** it observes `false`, because the getter folds the existing
  `NODE_ENV !== "production"` guard into the single seam

#### Scenario: The dev-role-switcher getter folds the production guard

- **GIVEN** `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` and `NODE_ENV=production`
- **WHEN** `nav-right-rail.tsx` or `role-switcher.tsx` reads the dev-role-switcher
  getter
- **THEN** it observes `false`, because the getter folds the same
  `NODE_ENV !== "production"` guard both consumers apply, so the dev role
  switcher never renders in a production build

### Requirement: Every current raw client-env consumer routes through the accessor

The web app MUST replace every current raw `process.env.NEXT_PUBLIC_*` read of
an in-scope var with a call to the typed accessor, at each named consumer site:
`apps/web/src/app/login-page.client.tsx` (`NEXT_PUBLIC_AUTH_STUB`,
`NEXT_PUBLIC_APP_VERSION`), `apps/web/src/shared/ui/navigation/nav-right-rail.tsx`
and `apps/web/src/shared/ui/auth-runtime/role-switcher.tsx` (`NEXT_PUBLIC_DEV_ROLE_SWITCHER`),
`apps/web/src/shared/lib/telemetry/client-logger.ts` (`NEXT_PUBLIC_CLIENT_LOG_FORWARDING`),
`apps/web/src/features/telemetry/model/vitals/web-vitals.ts` (`NEXT_PUBLIC_WEB_VITALS`),
`apps/web/instrumentation-client.ts` (`NEXT_PUBLIC_SENTRY_DSN`). A grep of
`apps/web/src` and the web root for a literal
`process.env.NEXT_PUBLIC_` read outside the accessor module and the
API URL seam MUST return no product-code hits (test files
excluded); the two server-runtime configs
`apps/web/sentry.server.config.ts` and `apps/web/sentry.edge.config.ts` use the
shared `sentry-options.config.ts` seam for their server-runtime Sentry options.

#### Scenario: A consumer reads the toggle through the accessor

- **GIVEN** `apps/web/src/features/telemetry/model/vitals/web-vitals.ts` needs to know whether web-vitals
  reporting is enabled
- **WHEN** it checks the toggle
- **THEN** it calls the accessor's boolean getter instead of comparing
  `process.env.NEXT_PUBLIC_WEB_VITALS === "true"` inline

#### Scenario: No stray raw read remains

- **GIVEN** the typed accessor owns the in-scope client environment variables
- **WHEN** `apps/web/src` and the web root are grepped for
  `process.env.NEXT_PUBLIC_` outside the accessor module, the
  API URL seam, excluding test files
- **THEN** the grep returns zero product-code hits

### Requirement: The accessor stays out of the API-URL surface

The `web-env` accessor MUST NOT declare or resolve `API_URL`; it stays owned by the `requireApiUrl` seam and the
`web-api-url-config` capability, which `next.config.ts` already build-asserts via
its top-level `requireApiUrl()` call.

#### Scenario: API-URL ownership is not duplicated

- **GIVEN** the `web-env` accessor and its schema
- **WHEN** they are inspected for `API_URL`
- **THEN** the key does not appear, so the `requireApiUrl` seam remains the single
  owner and no header/ownership collision with `web-api-url-config` occurs

### Requirement: Server-runtime Sentry configuration is validated at its shared seam

The shared `apps/web/sentry-options.config.ts` seam MUST read both
`SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` through explicit environment literals.
Each configured value MUST be a non-empty URL; an absent or empty value is
treated as unset. The server DSN MUST take precedence when both values are
valid, and a malformed value MUST throw a descriptive error before Sentry is
initialized. Both `sentry.server.config.ts` and `sentry.edge.config.ts` MUST
continue to initialize through this one seam.

#### Scenario: Server DSN takes precedence

- **GIVEN** both Sentry DSNs are valid URLs
- **WHEN** the shared Sentry options are created
- **THEN** `SENTRY_DSN` is selected

#### Scenario: Empty runtime DSNs are absent

- **GIVEN** either runtime DSN is empty or whitespace-only
- **WHEN** the shared Sentry options are created
- **THEN** that value is treated as unset and initialization remains valid

#### Scenario: Malformed runtime DSN fails closed

- **GIVEN** either runtime DSN is present but not a URL
- **WHEN** the shared Sentry options are created
- **THEN** creation throws a descriptive error naming that variable
