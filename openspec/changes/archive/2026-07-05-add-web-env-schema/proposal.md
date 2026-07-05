## Why

`apps/web` reads seven unvalidated `NEXT_PUBLIC_*` env vars through scattered
raw `process.env.X === "true"` checks with no validation (the eighth,
`NEXT_PUBLIC_API_URL`, is already validated by the separately-owned `requireApiUrl`
seam and stays out of scope) — a typo like
`NEXT_PUBLIC_DEV_ROLE_SWITCHR` or a malformed `NEXT_PUBLIC_SENTRY_DSN` fails
silently as "feature off", never loud. This is the one env-discipline gap the
`apps/api` `envSchema` already closed (`env-schema-coverage`) and the
`add-web-env-schema` candidate named in
`docs/handoff/EXEMPLARY-PROGRAM-2026-07-02.md` §8. It violates the repo
no-fallback / no-silent-default rule.

The web case is NOT the api case: `NEXT_PUBLIC_*` values are **build-time
inlined** by Next (string-replaced into the bundle), so a runtime
`schema.parse(process.env)` sees an empty object, not the values. The validation
story must therefore differ from the api boot-time schema — a build-time assert
plus a typed accessor that references each full literal.

## What Changes

- Add a single Zod schema describing the seven in-scope client vars, with
  meaningful validation (DSN = url-or-unset, boolean toggles = `"true"`/`"false"`
  or unset), no `.default()` anywhere.
- Assert that schema at **build time** inside `next.config.ts` so a malformed
  value fails `next build` loud.
- Add a typed accessor module (a `web-env` seam, sibling to `requireApiUrl`)
  that parses an explicit object literal of full `process.env.NEXT_PUBLIC_*`
  references — preserving inlining — and exposes typed derived getters. Every
  current raw read routes through it, killing the scattered `=== "true"` checks.
- Empty string counts as unset (mirrors `requireApiUrl`'s `nonEmpty`).

## Capabilities

### New Capabilities

- `web-env-validation`: the web app's client-env validation seam — a build-time
  assert plus a typed accessor for `NEXT_PUBLIC_*` reads, mirroring the api
  `env-schema-coverage` discipline under Next's build-time-inlining constraint.
  Sibling to `web-api-url-config` (which keeps ownership of `NEXT_PUBLIC_API_URL`
  / `API_URL`); this change does not touch that var.

### Modified Capabilities

<!-- none — ADDED-only; no existing web spec's requirements change -->

## Impact

- Planning only in this change. Implementation touches: `apps/web/next.config.ts`
  (build assert), a new `apps/web/src/lib/web-env.ts` accessor + its schema, and
  the seven consumer files (`login-page.client.tsx`, `nav-bar.tsx`,
  `role-switcher.tsx`, `client-logger.ts`, `web-vitals.ts`,
  `agentation-devtools.tsx`, `instrumentation-client.ts`).
- No data model, tRPC, or migration impact. No load-bearing invariant touched.
