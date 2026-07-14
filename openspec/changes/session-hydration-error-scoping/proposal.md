## Why

BL-05, P1, `docs/reviews/repo-excellence-review-2026-07-14.md`.

`resolveHumanSession` (`apps/api/src/infrastructure/trpc/trpc.context.ts:189-208`)
wraps token verification, the access-bar check, AND the full four-step
`hydrateSession` (`trpc.session-hydration.ts`) in one `try { ... } catch { return
null }`. Any throw from any of those — including a transient Postgres error
inside `hydrateReportingGroupName` or `hydrateOrganization` (both do
`findUnique`, and the org path also upserts on a cache miss) — collapses to
`null`, which the caller treats identically to an invalid/revoked token:
the web client redirects a fully-authenticated user to the login screen. The
function's own docstring scopes `null` to invalid/revoked/deactivated tokens
only; a DB blip does not fit that contract.

## What Changes

- Narrow the single `try/catch` in `resolveHumanSession` so it covers only
  `deps.verifySessionToken(token)` — the one step where a malformed/expired/
  tampered cookie legitimately throws and legitimately means "not a valid
  session".
- `isUserAccessBarred` and `hydrateSession` move outside that catch. A throw
  from either surfaces as an uncaught error from `resolveHumanSession`, which
  the tRPC context factory MUST let propagate as a retriable 500 (not a
  swallowed `null`/401), so the client can retry instead of being logged out.
- Total DB outage still fails closed: `isUserAccessBarred`'s own `isActive`
  read already throws on a hard DB failure today (not this change's
  concern) — the change only stops a _hydration_ hiccup from being
  misclassified as an _auth_ failure. No behavior change to a genuinely
  invalid/expired/revoked token, which still fails inside the narrowed catch.

## Claim disposition

| Claim (review doc)                                                               | Disposition                          | Note                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| BL-05 over-broad catch collapses hydration errors to `null`/logout               | CONFIRMED                            | Verified `resolveHumanSession` lines 189-208: single catch spans verify + `isUserAccessBarred` + `hydrateSession`. |
| "Total DB outage still fails closed via the isActive read" (review's own caveat) | CONFIRMED, unaffected by this change | `isUserAccessBarred`'s Prisma read is untouched; scope of this change is only the catch boundary.                  |

## Non-goals

- Not touching `isUserAccessBarred`'s own error handling or the Redis fast
  path inside it — the review does not flag it and it already fails closed.
- Not adding retry/backoff to `hydrateSession`'s DB calls — "propagate as a
  retriable 500" means the client's existing tRPC retry policy handles it,
  not that this change adds a new retry loop.
- Not changing what counts as an invalid token (algorithm pinning, secret
  strength) — that is `jwt-session-integrity`, already specified and
  untouched here.

## File manifest

- `apps/api/src/infrastructure/trpc/trpc.context.ts` — `resolveHumanSession`
  (lines 189-208): split the catch boundary.
- `apps/api/src/infrastructure/trpc/trpc.context.test.ts` — add a case: a
  throw from `hydrateSession`/`deps.prisma` inside hydration propagates
  (does not resolve to `null`).
- `apps/api/src/infrastructure/trpc/trpc.session-hydration.test.ts` — no
  behavior change expected here; re-run to confirm the four hydration steps'
  existing happy-path/cache-fallback coverage is untouched.

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — this touches session/auth context
  construction on every request; run the integration suite to confirm no
  route silently starts 401ing on a legitimate session.
- New unit test asserts: token-verify throw → `null`; `hydrateSession` throw
  → the error propagates out of `resolveHumanSession` (not swallowed).

## Sequencing

MUST land before `pdf-export-backend-lifecycle` (BL-13) — both changes touch
`apps/api/src/infrastructure/trpc/trpc.context.ts`. This change lands first
so `pdf-export-backend-lifecycle`'s edit to the same file (moving the
Redis-client construction under DI) is written against the narrowed catch,
not the original one, avoiding a rebase of one change's file manifest onto
the other's mid-file diff.
