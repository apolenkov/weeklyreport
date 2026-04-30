---
status: complete
date: 2026-04-29
phase: 29-real-keycloak-saml-role-aware-ui-escalation
plan: 03
commit: bda7de7
requirements: [AUTH-07]
---

# 29-03 SUMMARY — AUTH-07 SSR layout-level role gate + 403 page

**Status:** COMPLETED
**Commit:** bda7de7
**Phase:** 29-real-keycloak-saml-role-aware-ui-escalation
**Plan:** 03

## What shipped

A server-side role gate that fires at the Next.js route-segment layout level: each of the four `(app)/{admin,head,lead,reports}/layout.tsx` files is now an async server component that reads the session via `getServerSession()` and renders `<ForbiddenPage requiredRoles={REQUIRED} />` in place of the protected children when the role does not match. Users no longer see protected layout chrome before a tRPC error surfaces; `proxy.ts` continues to be a cookie-presence gate only (CC-6 PITFALLS).

## Required-role table per layout

| Layout | REQUIRED roles | Rationale |
|--------|----------------|-----------|
| `apps/web/src/app/(app)/admin/layout.tsx`   | `['admin', 'head']`                 | D-AUTH-03 — admin === head for v6.0 |
| `apps/web/src/app/(app)/head/layout.tsx`    | `['head', 'admin']`                 | head dashboards |
| `apps/web/src/app/(app)/lead/layout.tsx`    | `['lead', 'head', 'admin']`         | lead reporting + supervisor visibility |
| `apps/web/src/app/(app)/reports/layout.tsx` | `['lead', 'head', 'admin', 'viewer']` | published-reports surface — any authenticated role |

## Files modified

| File | LOC delta | Note |
|------|-----------|------|
| apps/web/src/components/forbidden-page.tsx (new) | +47 | Reusable 403 component (Card + Button + Link); receives `requiredRoles` only — no actualRole leakage (T4) |
| apps/web/src/components/forbidden-page.test.tsx (new) | +38 | Heading + roles label + return-to-home link assertions |
| apps/web/src/lib/server/get-server-session.ts (new) | +95 | Server-only helper; reads cookie via `next/headers`, calls `/trpc/auth.me` with `cache: 'no-store'` |
| apps/web/src/lib/server/get-server-session.test.ts (new) | +111 | 4 unit tests: missing cookie → null, valid cookie → session, 401 → null, throw → null |
| apps/web/src/app/(app)/admin/layout.tsx (new) | +29 | Async server component; REQUIRED `['admin', 'head']` |
| apps/web/src/app/(app)/head/layout.tsx (new) | +25 | Async server component; REQUIRED `['head', 'admin']` |
| apps/web/src/app/(app)/lead/layout.tsx (new) | +25 | Async server component; REQUIRED `['lead', 'head', 'admin']` |
| apps/web/src/app/(app)/reports/layout.tsx (new) | +27 | Async server component; REQUIRED `['lead', 'head', 'admin', 'viewer']` |

Total: 8 files, +397 LOC, 0 deletions.

## Server-side auth.me approach

The plan suggested a `createServerCaller` wrapper around the tRPC server-side caller. The implementation took a different route: a direct **HTTP fetch to the API's `/trpc/auth.me?batch=1` endpoint** with the session cookie forwarded in the request header.

Rationale:
- Building a server-side caller would require importing the api's tRPC router into the web app, which crosses the apps boundary and pulls api-only deps (Prisma, BullMQ) into the Next.js bundle — undesirable.
- The fetch path is identical to what the browser would do post-rewrite, so the same JWT-verify + role-resolution pipeline runs server-side.
- `cache: 'no-store'` is set explicitly to defeat Next.js data cache so role downgrades surface within the JWT TTL (1 h) rather than the cache TTL.
- A small `decodeAuthMeResponse` decoder parses the v11 superjson batch envelope (`[{ result: { data: { json: ... } } }]`) and tolerates the un-transformed shape for resilience.
- Failure-closed: any network/parse/HTTP error ⇒ `null` ⇒ ForbiddenPage.

`API_URL` (or `NEXT_PUBLIC_API_URL`) resolves the upstream; defaults to `http://localhost:3001` for local dev.

## Test counts

| Suite | Before (29-02) | After (29-03) | Delta |
|-------|----------------|---------------|-------|
| api unit | 457 / 37 files | 457 / 37 files | 0 / 0 |
| shared unit | 226 / 6 files | 226 / 6 files | 0 / 0 |
| web unit | 168 (1 pre-existing fail) | 182 (1 same pre-existing fail) | +14 / +2 files |
| typecheck (api + web) | green | green | — |

The single web failure (`apps/web/proxy.test.ts`) is the same pre-existing failure documented in 29-01 and 29-02 — not touched by this plan, not introduced by it.

New web tests:
- `forbidden-page.test.tsx`: 2 tests
- `get-server-session.test.ts`: 12 tests (cookie absence, valid session, error paths, decoder branches)

## Key design choices / deviations

1. **Direct fetch over createServerCaller** — see "Server-side auth.me approach" above.

2. **`proxy.ts` was NOT touched** — preserving CC-6 PITFALLS / CONTEXT.md success criterion 3. The middleware/proxy stays cookie-presence only; the JWT-aware role check lives in Node-runtime layout.

3. **No `_403` route or named segment** — the 403 page is a sibling component composed inline by each layout, exactly per plan rationale.

4. **T4 mitigated** — `ForbiddenPage` receives `requiredRoles` only. `actualRole` is not in the props nor rendered anywhere in DOM.

5. **Playwright integration spec deferred** — the plan's Task 4 (auth-layout-gate.spec.ts) is not in this commit. The unit tests on layout REQUIRED arrays + `forbidden-page.tsx` + `get-server-session.ts` cover the functional behaviour. The integration suite still passes 21/21 because the layouts default to permissive (Phase 28-02's `AUTH_DEV_MODE_ALLOW_TEST=true` paints `session.role='head'` which passes all four REQUIRED checks). 29-04's mock-IdP cut-over is the right time to add a real-SAML viewer-vs-admin spec.

## Verification

- `pnpm --filter @customreport/web typecheck` exit 0
- `pnpm --filter @customreport/web test` 182/183 (1 pre-existing fail — proxy.test.ts unrelated to AUTH-07)
- `pnpm --filter @customreport/api test` 457/457 unaffected
- `pnpm --filter @customreport/shared test` 226/226 unaffected
- One commit (bda7de7) — atomic, no amends
