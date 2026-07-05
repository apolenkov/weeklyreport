## Context

The web app resolves the API base URL through a copy-pasted
`process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"`
chain at five sites: `next.config.ts`,
`components/common/api-readiness-placeholder.tsx` (dead — no importer), and the
three server helpers `get-org-public.ts`, `get-server-session.ts`,
`get-print-route-context.ts`. A sixth site, `app/api/client-logs/route.ts`,
carries a SHORTER two-leg variant —
`process.env.API_URL ?? "http://localhost:3002"`, with NO `NEXT_PUBLIC_API_URL`
leg. Rewiring it to `requireApiUrl` therefore adds that public leg (see the
client-logs behavior-change decision below). The three helpers additionally each re-implement
the tRPC v11 superjson batch-envelope decode (`TrpcBatchEntry` + `{ json }`
unwrap), and two of them re-inline the dev-auth fallback predicate
(`NODE_ENV !== "production" && (AUTH_DEV_MODE || AUTH_DEV_MODE_ALLOW_TEST)`).

Recon confirmed `apps/web` has NO env validation (unlike `apps/api`, which
validates via a Zod `env.schema`). The `?? "http://localhost:3002"` default is
the reason a web environment with no `API_URL` set "works" — it silently
targets a dead localhost instead of failing at boot. This violates the repo's
no-fallback / no-silent-default rule (`docs/exemplary-code-standard.md`).

Current SET-side inventory (where the URL is supplied today):

```
root .env, apps/web/.env, apps/web/.env.local  → NEXT_PUBLIC_API_URL set
docker-compose.yml/.dev.yml/.prod.yml          → API_URL + NEXT_PUBLIC_API_URL
.github/workflows/ci.yml (both jobs)           → NEXT_PUBLIC_API_URL
e2e/sweep/playwright.config.ts                 → NEXT_PUBLIC_API_URL
e2e/playwright.integration.config.ts           → NEXT_PUBLIC_API_URL (self-default, if-unset)
.env.test / .env.test.example                  → NEITHER set  ← the config-file gap
web vitest (apps/web/vitest.config.ts)         → NO env file loaded  ← the test-suite gap
```

Two suppliers here are tooling-level self-defaults, accepted as such (not the
product config this change fails-loud on): `e2e/playwright.integration.config.ts`
sets `process.env.NEXT_PUBLIC_API_URL` from its own `127.0.0.1:<port>` literal
only if unset (lines 25-26), and `e2e/sweep/playwright.config.ts` supplies it for
its own webServer. Both feed the E2E run, not `pnpm test`.

The web unit suite is a distinct gap: `apps/web/vitest.config.ts` declares no
`test.env` and loads no `.env` file, so root `.env.test` (gitignored,
machine-local) never reaches it. The existing helper tests
(`get-server-session.test.ts`, `get-print-route-context.test.ts`) drive the
URL-resolving path with fetch mocked and no API-URL stub — they pass today ONLY
because the removed localhost fallback keeps `resolveApiUrl` from throwing.
Removing the fallback turns them red on a fresh clone unless they stub the var
directly (see Risks + task 1.1).

## Goals / Non-Goals

**Goals:**

- One server module (`apps/web/src/lib/server/api-url.ts`) owning the three
  seams: `requireApiUrl`, `decodeTrpcBatchPayload`, `shouldUseDevAuthFallback`.
- Fail-loud on a missing API URL — no hardcoded default anywhere.
- Remove the dead `api-readiness-placeholder.tsx`.
- Preserve today's behavior for every environment that already sets the var.

**Non-Goals:**

- A full `apps/web` env-validation schema mirroring `apps/api` (that is a
  larger, separate change). This change fails loud for the API URL only.
- Changing the `API_URL` → `NEXT_PUBLIC_API_URL` precedence, the rewrite
  targets, or any auth / decode behavior.
- Touching `apps/api` or shared schemas.

## Decisions

**Plain module, not `server-only`.** `next.config.ts` loads in Node at config
time, outside the React Server Component graph. Importing the `server-only`
package there would throw. The new module therefore does NOT import
`server-only`; it stays a plain server/build-time module. This is safe because
the only client-component consumer of `NEXT_PUBLIC_API_URL`
(`api-readiness-placeholder.tsx`) is deleted, so nothing pulls the module into
a client bundle. Alternative considered: two modules (one `server-only` for the
helpers, one plain for `requireApiUrl`) — rejected as over-split for three tiny
pure functions with a shared concern.

**`decodeTrpcBatchPayload` returns `unknown | null`, callers narrow.** The
three existing decoders differ only in the typed field extraction after the
envelope unwrap. The shared helper owns the batch-envelope + superjson `{ json }`
unwrap (returning the raw inner payload or `null`); each call site keeps its own
Zod-adjacent narrowing (`decodeAuthMeResponse`, `decodePrintGateResponse`,
`decodeOrgPublicResponse` collapse to a narrow-only step). This keeps the seam
deep enough to remove the real duplication without leaking each caller's shape
into the shared module.

**Fail-loud, no default.** `requireApiUrl` throws a descriptive error naming
both env vars when neither is set, rather than returning any fallback. This is
the point of the change and matches `requireEnv` usage elsewhere in the repo.

**client-logs gains the `NEXT_PUBLIC_API_URL` leg (intended behavior change).**
`app/api/client-logs/route.ts` today reads `API_URL` only (its localhost fallback
has no public leg). Rewiring it to `requireApiUrl` adds the `NEXT_PUBLIC_API_URL`
precedence step, so an environment that sets ONLY `NEXT_PUBLIC_API_URL` (root
`.env`, CI) changes this route's log-forwarding target from the localhost default
to that public origin. This is accepted, not a regression: every such
environment already points `NEXT_PUBLIC_API_URL` at the real API, so the route
now forwards to the correct host instead of a dead localhost. It uniformizes all
six sites on one precedence chain. Alternative — keep client-logs on an
`API_URL`-only helper — rejected: it would preserve a second, divergent
resolution rule, defeating the centralization goal.

## Risks / Trade-offs

- **Removing the fallback breaks environments that were silently riding it.**
  → Mitigation: the SET-side inventory above is exhaustive. The web UNIT suite
  is the real green-keeping gap, and `.env.test` is NOT the fix for it: web
  vitest loads no env file, and `.env.test` is gitignored/machine-local, so it
  never reaches the suite. The deterministic fix is to stub
  `NEXT_PUBLIC_API_URL` inside the two helper tests
  (`get-server-session.test.ts`, `get-print-route-context.test.ts`) that drive
  `resolveApiUrl` today, or add a `test.env` block to
  `apps/web/vitest.config.ts`. (`.env.test.example` is still updated for local
  integration-suite parity, but it is not what makes `pnpm test` green.) See
  task 1.1.
- **`next.config.ts` loads on nearly every `next` invocation** (build, and
  potentially lint via the Next ESLint plugin). If `requireApiUrl` throws
  there with no var set, `pnpm build` fails. → Mitigation: the root `.env` and
  `apps/web/.env` already set `NEXT_PUBLIC_API_URL`; the gate is run with those
  present. Verification step must run `pnpm build` to confirm.
- **A local `pnpm dev` from source with a wiped `.env`** would now fail loud
  instead of defaulting. → This is the intended, desired behavior. Only the prod
  build-args block of `.env.example` currently flags the var as required; the
  `API_URL` comment block (lines 155-157) still describes a `resolveApiUrl`
  server-side default of `http://api:3001` that this change deletes. That comment
  must be rewritten to "required, no default, resolved via `requireApiUrl`" (task
  1.3) so the doc does not advertise a fallback that no longer exists.

## Migration Plan

1. Make the web unit suite deterministic before touching code: stub
   `NEXT_PUBLIC_API_URL` in the two helper tests (or add `test.env` to
   `apps/web/vitest.config.ts`), and add `NEXT_PUBLIC_API_URL` to
   `.env.test.example` for local integration parity. Rewrite the `.env.example`
   `API_URL` comment (no default, `requireApiUrl`).
2. Add `apps/web/src/lib/server/api-url.ts` with the three seams + unit tests.
3. Rewire the five live consumers; delete `api-readiness-placeholder.tsx`.
4. Run the full gate (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`)
   with the env vars present.

Rollback: revert the change set; the inline fallback returns. No data or schema
state is involved, so rollback is a pure code revert.

## Load-Bearing Invariants

This change touches NONE of the load-bearing invariants: not period dual-state,
not the role-coverage gate (no tRPC procedure or middleware chain changes), not
the destructive-db guard (no DB access), not the deferred-feature pattern (the
deleted file is dead code, not a deferred/ComingSoon surface). It only
centralizes web-side config resolution.

## Open Questions

None. The seam boundaries, precedence, and both gaps (the web unit suite loading
no env file, and `.env.test.example`) are resolved by the inventory above; the
client-logs public-leg addition is an accepted, documented behavior change.
