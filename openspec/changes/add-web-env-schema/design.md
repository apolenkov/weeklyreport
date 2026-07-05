## Context

`apps/api` validates every consumed env var through one Zod `envSchema`
(`env-schema-coverage`), parsed once at boot; a missing/malformed value fails
loud. `apps/web` has no equivalent. Its only env seam is `requireApiUrl`
(`web-api-url-config`) for `API_URL` / `NEXT_PUBLIC_API_URL`. Everything else is
a scattered raw read:

```
login-page.client.tsx   NEXT_PUBLIC_AUTH_STUB === "true" && NODE_ENV!==production
login-page.client.tsx   NEXT_PUBLIC_APP_VERSION (footer suffix)
nav-bar.tsx              NEXT_PUBLIC_DEV_ROLE_SWITCHER === "true" && NODE_ENV!==production
role-switcher.tsx        NEXT_PUBLIC_DEV_ROLE_SWITCHER === "true" && NODE_ENV!==production
client-logger.ts         NEXT_PUBLIC_CLIENT_LOG_FORWARDING !== "true"
web-vitals.ts            NEXT_PUBLIC_WEB_VITALS !== "true"
agentation-devtools.tsx  NEXT_PUBLIC_DISABLE_DEVTOOLS === "true"
instrumentation-client.ts NEXT_PUBLIC_SENTRY_DSN
```

The hard constraint is Next's **build-time inlining**: `next build` string-
replaces each `process.env.NEXT_PUBLIC_X` occurrence in client code with a
string literal. At browser runtime there is no `process.env` object holding
these keys — so the api pattern (`schema.parse(process.env)` at boot) cannot be
transplanted; it would parse an empty object.

## Goals / Non-Goals

**Goals:**

- One Zod schema for the seven in-scope client vars, no `.default()`, meaningful
  per-field validation (typos rejected, not read as "off").
- Fail `next build` loud on a malformed value (build-time assert).
- A single typed accessor seam that every consumer reads through, preserving
  inlining, killing the scattered `=== "true"` comparisons.
- Empty string = unset, consistent with `requireApiUrl`.

**Non-Goals:**

- `NEXT_PUBLIC_API_URL` / `API_URL` — owned by `requireApiUrl` /
  `web-api-url-config`; not redeclared here (the ownership collision to avoid).
- The server-runtime `SENTRY_DSN ?? NEXT_PUBLIC_SENTRY_DSN` chain in
  `sentry.server.config.ts` / `sentry.edge.config.ts` — server-runtime reads on
  a different validation surface; deferred to a follow-up, named not dropped.
- Runtime-configurable client env (env at request time) — Next inlining makes
  `NEXT_PUBLIC_*` build-frozen by design; out of scope.
- Implementation itself — this change is planning only.

## Decisions

### D1 — Build-time assert in `next.config.ts`, not a runtime boot parse

`next.config.ts` runs in Node during `next build`, where the real
`NEXT_PUBLIC_*` values are still in `process.env` before inlining. Parsing the
schema there fails the build on a malformed value — the loudest, earliest gate
available. Alternative considered: a runtime parse in a client provider —
rejected because after inlining there is nothing to iterate, and a client throw
ships the misconfig to the browser instead of blocking the artifact.

### D2 — Accessor parses an explicit object literal of full literals

This is the load-bearing mechanic. The accessor MUST NOT do
`schema.parse(process.env)` (empty at runtime) and MUST NOT destructure or
index `process.env[key]` (defeats inlining). It builds:

```
function readEnv() {
  const raw = {
    NEXT_PUBLIC_AUTH_STUB: process.env.NEXT_PUBLIC_AUTH_STUB,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    … all seven …
  };
  return webEnvSchema.parse(raw);   // one schema, both build + runtime
}
```

Each right-hand side is a full literal Next can string-replace, so the parsed
object holds the inlined values in the browser. One schema serves both the
build-time assert (D1) and the runtime accessor.

**Parse LAZILY, at getter call time — not at module scope.** A module-scope
`const env = webEnvSchema.parse(raw)` freezes values at first import, but the
existing suite mutates `process.env.NEXT_PUBLIC_*` after import
(`role-switcher.test.tsx` in `beforeEach`; `login-page.client.test.tsx` /
`page.test.tsx` with `vi.resetModules()`), matching today's lazy per-render read.
A getter that calls `readEnv()` on demand preserves that timing; inlining is
unaffected because the object of full literals is built inside the getter and
Next string-replaces it there just the same. Memoization is optional but must not
reintroduce an eager module-scope freeze.

### D3 — Typed derived getters, not raw string passthrough

The accessor exposes booleans for the five toggles (the `=== "true"` compare
lives once), plus `appVersion` and `sentryDsn`. Two of the toggle getters fold a
`NODE_ENV !== "production"` guard so callers can't forget it — matching the
current code exactly:

- `authStub` folds `NODE_ENV !== "production"` (as `login-page.client.tsx` does today).
- `devRoleSwitcher` folds `NODE_ENV !== "production"` (as **both** `nav-bar.tsx`
  and `role-switcher.tsx` do today — dropping it would render the dev role
  switcher in a production build where `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`).

The remaining three toggles (`clientLogForwarding`, `disableDevtools`,
`webVitals`) are the bare `=== "true"` resolve, no NODE_ENV fold. Empty string
coerces to unset inside the schema (see D4), not per-getter. Rationale: the
exemplary target is "one seam, no scattered magic-string compares", matching how
the api side reads `env.X` off a validated object.

### D4 — Meaningful validation, framed as reject-malformed not require-present

All seven are optional, so mirroring api's "missing required fails boot"
scenario would be dishonest — the assert would catch nothing. Instead each
field validates SHAPE: DSN = url-or-unset, the five
toggles = `z.enum(["true","false"]).optional()` so `ture` is a build error,
`APP_VERSION` = `z.string().optional()`. The value the gate adds is typo/format
rejection, not presence.

**Empty string → unset belongs IN the schema, not on the accessor.** Each field
wraps its type in a `z.preprocess` that maps `""` to `undefined` before
validating (e.g. DSN = `z.preprocess(emptyToUndefined, z.url().optional())`).
This is load-bearing because BOTH parse sites share the one schema: the build
assert (D1) parses raw `process.env` values, and `docker-compose.dev.yml` passes
`NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN_DOCKER:-}` — an empty string
when unset. If the empty→unset coercion lived only on the accessor's `nonEmpty`
idiom, the build assert would feed `""` straight into `z.url()` and break the
docker dev build. Putting the preprocess in the schema makes empty→unset uniform
across the assert and the accessor, so `requireApiUrl`'s `nonEmpty` is no longer
needed at the accessor call site for these fields.

## Before / After data flow

```
BEFORE  component ──raw──> process.env.NEXT_PUBLIC_X === "true"   (per site, unvalidated)

AFTER   next build ─┐
                    ├─> webEnvSchema.parse({ …full literals… })
   component ──> web-env accessor (booleans / appVersion / sentryDsn)
   next.config.ts ─┘        ↑ build-time assert throws on malformed
```

## Load-bearing invariants

- Period dual-state, role-coverage gate, destructive-db guard — untouched
  (no tRPC / Prisma / write-path surface).
- Deferred-feature pattern — untouched; the `SENTRY_DSN` server chain is
  recorded as an explicit out-of-scope follow-up (Non-Goals), not a hidden flag.
- `web-api-url-config` — preserved by exclusion: the accessor never names
  `API_URL` / `NEXT_PUBLIC_API_URL`.

## Risks / Trade-offs

- **A future consumer destructures `process.env` and reads an in-scope var,
  silently un-inlined** → the spec's grep requirement (zero raw
  `process.env.NEXT_PUBLIC_` hits outside the seam) is the standing guard; wire
  it as a lint/CI check when the accessor lands.
- **`restructure-directory-architecture` is in-flight and may move
  `apps/web/src/lib`** → specs anchor on logical seams ("the `web-env`
  accessor", "the `requireApiUrl` seam") and name paths as the current location,
  so a move updates the path without invalidating the contract.
- **Build-time freeze surprises an operator expecting runtime env** → documented
  as a Non-Goal; `NEXT_PUBLIC_*` is build-frozen by Next's design, unchanged by
  this work.

## Migration Plan

Additive, no data/schema migration. Land the schema + accessor + build assert,
convert the seven sites, run the gate (`pnpm typecheck && pnpm lint && pnpm test
&& pnpm build`). Rollback = revert the commit; env supply per environment is
unchanged.

## Open Questions

- None blocking. The `SENTRY_DSN` server-runtime chain follow-up can be scoped
  separately once this seam exists.
