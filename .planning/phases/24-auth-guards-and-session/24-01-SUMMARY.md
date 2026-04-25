---
phase: 24
plan: 01
subsystem: auth-guards-and-session
tags: [auth, session, proxy, trpc, nextjs-16, v5.0]
requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]
dependency_graph:
  requires:
    - apps/api auth.routes.ts (cookie name: customreport_session)
    - apps/api trpc.context.ts DEV_SESSION + AUTH_DEV_MODE fallback
    - apps/web makeTRPCClient + TRPCProxyContext (existing)
  provides:
    - apps/web/proxy.ts — Next.js 16 cookie-existence guard
    - SessionProvider + useSession hook (apps/web/src/lib)
    - 401 interceptor link (apps/web/src/lib/trpc.ts)
    - auth.me tRPC query (apps/api router)
    - Login page ?next= consumption + open-redirect guard
  affects:
    - apps/web/src/app/(app)/layout.tsx (now wraps children in SessionProvider)
    - All (app)/ pages can now call useSession() (no consumer wired in this plan)
tech_stack:
  added:
    - "@trpc/server@^11.16.0 (apps/web — needed for /observable subpath)"
  patterns:
    - "Next.js 16 proxy.ts at apps/web/ root replaces middleware.ts"
    - "tRPC custom link before httpBatchLink for cross-cutting 401 handling"
    - "Pure-function redirect handler (createAuthRedirectHandler) for unit testability"
    - "publicProcedure-backed auth.me — never throws on null, avoids 401 loop on every page"
    - "URL-encoded ?next= with open-redirect sanitization (reject '://', '//')"
key_files:
  created:
    - apps/web/proxy.ts (57 lines)
    - apps/web/proxy.test.ts (123 lines)
    - apps/web/src/lib/session-provider.tsx (76 lines)
    - apps/web/src/lib/use-session.ts (4 lines)
    - apps/web/src/lib/session-provider.test.tsx (102 lines)
    - apps/web/src/lib/trpc.test.ts (98 lines)
    - .planning/phases/24-auth-guards-and-session/deferred-items.md
  modified:
    - apps/api/src/infrastructure/trpc/trpc.router.ts (+12 lines — auth.me namespace)
    - apps/web/src/app/(app)/layout.tsx (wraps in SessionProvider)
    - apps/web/src/app/page.tsx (client component + sanitizeNext + ?next= consumption)
    - apps/web/src/lib/trpc.ts (+ createAuthRedirectHandler + link)
    - apps/web/package.json (+ @trpc/server dep)
decisions:
  - id: D-24-01-A
    summary: "auth.me uses publicProcedure (not protectedProcedure) — returns null instead of throwing UNAUTHORIZED. Otherwise the 401 interceptor would fire on every page load."
  - id: D-24-01-B
    summary: "Redirect target is '/' (not '/login'). This app's login page is at the root route — there is no /login route."
  - id: D-24-01-C
    summary: "createAuthRedirectHandler exposed as a separately-exported pure function so tests don't need to construct the observable. The observable wrapper is a thin shim around it."
  - id: D-24-01-D
    summary: "Added @trpc/server as a direct dep of apps/web rather than working around the missing /observable subpath. tRPC v11 requires it for the link API."
  - id: D-24-01-E
    summary: "AUTH_REDIRECT_EXEMPT regex: ^/(?:$|auth(?:/|$)) — matches '/' exactly and '/auth' or '/auth/*'. Tightened from the spec's ^/(login|auth)/ because /login does not exist."
metrics:
  duration: ~10 minutes
  completed_date: 2026-04-25
  tasks_completed: 4
  commits: 5
  tests_added: 16
  files_created: 7
  files_modified: 5
---

# Phase 24 Plan 01: Auth Guards & Session Provider Summary

Cookie-existence guard via Next.js 16 proxy.ts, SessionProvider exposing `useSession()` across all (app)/ routes, 401 interceptor link redirecting to `/?next=<path>`, auth.me tRPC query as the session source — closing AUTH-01..AUTH-04 for v5.0 Production Integration.

## What Was Built

### Backend (apps/api)

- **`auth.me` query** added as a top-level `auth` namespace in `trpc.router.ts`. Uses `publicProcedure` so it returns `null` for unauthenticated callers instead of throwing — critical for avoiding redirect loops on the SessionProvider's initial query.
- Existing `AUTH_DEV_MODE=true` fallback in `trpc.context.ts` already returns `DEV_SESSION` when no cookie is present, so `auth.me` works identically in stub and real modes with no client-side branching.

### Frontend (apps/web)

- **`apps/web/proxy.ts`** — Next.js 16 replacement for middleware.ts. Reads `NEXT_PUBLIC_AUTH_STUB` at request time; when not stub mode, requires the `customreport_session` cookie or issues a 307 redirect to `/?next=<encoded-original-path>`. Matcher `/((?!_next|api|trpc|auth|favicon\.ico|$).*)` excludes login, auth callback, tRPC, REST, Next internals, and favicon.
- **`SessionProvider`** + **`useSession()`** — client-side context fed by `auth.me` via `useQuery`. Maps `UserSession → { id, name, email, role }`. Three states: loading (data undefined), authenticated (data non-null), unauthenticated (data null). `useSession()` throws a clear error when used outside the provider.
- **`(app)/layout.tsx`** — now wraps NavBar + children in `<SessionProvider>` so any (app)/ page can call `useSession()`.
- **401 interceptor link** in `trpc.ts` — runs BEFORE `httpBatchLink`. Pure helper `createAuthRedirectHandler()` (separately exported for unit tests) detects `httpStatus===401 || code==='UNAUTHORIZED'`, skips when `window` is undefined / not a `TRPCClientError` / current path matches `^/(?:$|auth(?:/|$))`, and otherwise calls `window.location.assign('/?next=<encoded>')`. The link wraps it in a `@trpc/server/observable` so error propagation is suppressed during the redirect.
- **Login page (`apps/web/src/app/page.tsx`)** — converted to a client component to read `useSearchParams()`. `sanitizeNext()` rejects open-redirect attempts (`'://'` and `//`-prefixed paths) and falls back to `/head/dashboard`. Stub-mode role buttons honor `?next=` when explicitly provided; the SSO link in real mode forwards the same `?next=` to `/auth/saml/login`.

## Test Coverage

| File                                    | New Tests | Cases                                                                                                                                                                                          |
| --------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/proxy.test.ts`                | 6         | redirect on missing cookie + non-stub; query string preserved; cookie passes through; AUTH_STUB=true bypasses; config matcher exists; matcher contains expected exclusions                     |
| `apps/web/src/lib/session-provider.test.tsx` | 4    | loading state; authenticated state with mapped fields; unauthenticated (null data) state; throws when called outside provider                                                                   |
| `apps/web/src/lib/trpc.test.ts`         | 6         | redirect on 401; query string preserved in next=; no redirect on / (login); no redirect on /auth/error; no redirect on 500; no redirect on plain Error objects                                  |

**Total new tests: 16, all passing.** No regressions in pre-existing passing test suites.

## Verification Status

| Check                                                       | Result                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @customreport/api typecheck`                 | Clean (note: pre-existing TS6133 in period.contract.test.ts — see deferred-items.md, not caused by this plan)           |
| `pnpm --filter @customreport/web typecheck`                 | Clean                                                                                                                   |
| `pnpm --filter @customreport/api test`                      | 386/386 passed                                                                                                          |
| `pnpm --filter @customreport/web vitest run` (new files)    | 16/16 passed                                                                                                            |
| `pnpm --filter @customreport/web vitest run` (whole app)    | 167 passed, 5 pre-existing failures in `weekly-report-page.test.tsx` (mocks `pdfExport.request` — see deferred-items.md, reproduces on prior commit) |

## Deviations from Plan

### Auto-fixed / Adjusted

1. **[Rule 3 - Blocking] Added `@trpc/server` as a direct dep of `apps/web`**
   - **Found during:** Task 4 (vite import error: "Failed to resolve @trpc/server/observable").
   - **Issue:** The 401 interceptor link uses `observable()` from `@trpc/server/observable`, but `apps/web` had only `@trpc/client` listed. Vite refused to resolve the subpath through pnpm's strict module isolation.
   - **Fix:** Added `"@trpc/server": "^11.16.0"` to `apps/web/package.json` and ran `pnpm install --config.proxy="" --config.https-proxy=""`. tRPC v11's link API requires the observable from the server package — this is a documented and intended dependency.
   - **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml` (gitignored).
   - **Commit:** `6da50fb`

2. **[Rule 2 - Critical] Tightened `AUTH_REDIRECT_EXEMPT` regex**
   - **Found during:** Task 4 (review of the spec's `/^\/(login|auth)/` pattern).
   - **Issue:** Spec mentions `/login` but this codebase's login page is at `/`. The provided regex would not exempt `/` from the redirect, causing a loop on the login page itself.
   - **Fix:** Used `^/(?:$|auth(?:/|$))` — exempts `/` exactly and any `/auth` or `/auth/*` path.
   - **Files modified:** `apps/web/src/lib/trpc.ts`
   - **Commit:** `6da50fb`

3. **[Rule 2 - Security] Open-redirect guard on `?next=`**
   - **Found during:** Task 4 (matched the plan's instruction explicitly — `sanitizeNext()` rejects `'://'` and `'//'` prefixes).
   - **Issue:** Without the guard, an attacker could craft `/?next=//evil.com` and the login page would redirect there.
   - **Fix:** `sanitizeNext()` falls back to `/head/dashboard` for any value that doesn't start with a single `/`, includes `://`, or is empty.
   - **Files modified:** `apps/web/src/app/page.tsx`

### Refactored Test Strategy

- Plan suggested testing the link's observable wiring directly. Instead, the redirect logic was extracted into a standalone exported `createAuthRedirectHandler()` function, which is trivially unit-testable without instantiating an observable subscription. The link wrapper is a thin shim and is exercised indirectly via typecheck (its type must satisfy `TRPCLink<AppRouter>`).

## Pitfalls / Notes for Future Work

- **`@trpc/server` is now a runtime dep of the web bundle.** Tree-shaking should keep only `observable` in the final bundle, but verify with a build analyzer if bundle size becomes a concern.
- **Cookie name matters.** The plan locked `customreport_session` (matching `trpc.context.ts:27` and `auth.routes.ts`). Do not introduce `customreport.sid` from the older CONTEXT.md placeholder.
- **`useSession()` returns `user: null` in the brief window between mount and `auth.me` resolution.** Consumers that render user data should branch on `isLoading` or `user`, not assume `user` is always non-null.
- **Login page is now a client component.** This was previously a server component; the change has minor SEO implications (the login page is no longer SSR-rendered for static metadata — but Next.js still handles the wrapper layout server-side).

## Follow-ups for v6.0

- Wire `useSession()` into `NavBar` to display the real user's name/avatar (instead of inferring role from pathname).
- Real SAML flow — replace AUTH_STUB with full SAML callback handling, JWT issuance, refresh-token rotation.
- Role-based proxy guards (e.g., `/admin/*` requires `role === 'head'`).
- Session refresh cron via `auth.me` invalidation every 5 minutes.
- Multi-tenancy / org context plumbed into the session.

## Known Stubs

None introduced by this plan. The login page's stub-mode role buttons predate this plan and remain governed by `NEXT_PUBLIC_AUTH_STUB`. They will be replaced when the real SAML flow lands in v6.0.

## Deferred Issues (out of scope)

Logged in `deferred-items.md`:

1. Pre-existing `apps/api/src/modules/period/period.contract.test.ts:65` TS6133 (unused `userId`) — reproduces on prior commit.
2. Pre-existing 5 failures in `apps/web/src/components/weekly-report/weekly-report-page.test.tsx` — incomplete tRPC mock for `pdfExport.request.mutationOptions`. Reproduces on prior commit.

## Commits

| Task   | Commit    | Subject                                                                          |
| ------ | --------- | -------------------------------------------------------------------------------- |
| 1      | `c1fccd7` | `feat(24-01): add auth.me tRPC query for session source`                         |
| 2 (T)  | `d6261ef` | `test(24-01): add failing test for proxy.ts auth guard`                          |
| 2 (I)  | `25ddce4` | `feat(24-01): add Next.js 16 proxy.ts auth guard`                                |
| 3      | `f454aaf` | `feat(24-01): add SessionProvider + useSession; wrap (app)/ layout`              |
| 4      | `6da50fb` | `feat(24-01): add tRPC 401 interceptor + login page reads ?next=`                |

## Self-Check: PASSED

All 10 tracked files verified present:
- `apps/web/proxy.ts`, `apps/web/proxy.test.ts`
- `apps/web/src/lib/session-provider.tsx`, `use-session.ts`, `session-provider.test.tsx`
- `apps/web/src/lib/trpc.ts`, `trpc.test.ts`
- `apps/web/src/app/page.tsx`, `apps/web/src/app/(app)/layout.tsx`
- `apps/api/src/infrastructure/trpc/trpc.router.ts`

All 5 commit hashes verified in git log: `c1fccd7`, `d6261ef`, `25ddce4`, `f454aaf`, `6da50fb`.
