# Phase 6: Auth & Frontend Integration - Research

**Researched:** 2026-04-10
**Domain:** SAML SSO authentication, tRPC React client, localStorage-to-API migration
**Confidence:** HIGH

## Summary

Phase 6 integrates two parallel workstreams: (1) wiring the existing SAML/JWT auth code into working NestJS Express routes and the tRPC context factory, and (2) replacing all frontend localStorage with tRPC React Query hooks backed by the real API. The auth code (controller, strategies, guards) already exists but is not mounted on Express routes. The tRPC backend (AppRouter with 7 namespaces, context factory with dev bypass placeholder, middleware with role checks) is fully operational from Phase 5.

The frontend has 7 page components and ~11 files importing from localStorage helpers (`section-storage.ts`, `report-runtime.ts`, `admin-runtime.ts`, `dev-session.ts`, `use-browser-state.ts`, `demo-section.ts`). All must be rewritten to use tRPC hooks. Currently 32 tests fail: 24 frontend component tests (all fail with `ReferenceError: document is not defined` -- jsdom environment not configured for Vitest), 7 E2E spec stubs, and 1 backend integration test. The frontend test failures are environment configuration issues, not logic bugs.

**Primary recommendation:** Wire auth routes first (backend-only, testable independently), then install tRPC client packages and create the Provider, then migrate pages one-by-one from localStorage to tRPC hooks, and finally fix all tests with MSW mocking.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** JWT session cookie TTL = 1 hour (already configured in auth.controller.ts `ONE_HOUR_IN_SECONDS`)
- **D-02:** No refresh token -- when JWT expires, redirect to Keycloak (SSO session still alive -> instant re-login)
- **D-03:** Auth errors (Keycloak down, invalid assertion) -> dedicated `/auth/error` page with human-readable message and "Try again" button
- **D-04:** Use reference-app (forge.example.org/example/platform/reference-app) as reference implementation for SAML/Keycloak config -- take base patterns and configurations from there
- **D-05:** `@trpc/react-query` (TanStack Query) as the tRPC client for Next.js -- hooks pattern: `trpc.reports.getActive.useQuery()`, `trpc.reports.saveDraft.useMutation()`
- **D-06:** tRPC client + Provider at `apps/web/src/lib/trpc.ts`, TRPCProvider wraps app in `layout.tsx`
- **D-07:** `httpBatchLink` pointing to `http://localhost:3001/trpc` (configurable via env), cookie forwarding for auth
- **D-08:** Big-bang replacement -- all localStorage calls replaced with tRPC hooks in one phase. Delete `section-storage.ts`, `report-runtime.ts`, `admin-runtime.ts`, `demo-section.ts`, `demo-data` files, and `use-browser-state.ts`
- **D-09:** `dev-session.ts` deleted -- dev bypass is now server-side only (trpc.context.ts `AUTH_DEV_MODE=true` returns hardcoded session via cookie)
- **D-10:** Remove all `STORAGE_KEY` constants and `localStorage.getItem/setItem` calls from frontend
- **D-11:** Unit/component tests mock tRPC via MSW (Mock Service Worker) -- intercept HTTP at network level
- **D-12:** E2E tests (Playwright) run against real NestJS API + PostgreSQL -- maximum fidelity
- **D-13:** Fix all 24 previously-failing frontend tests after tRPC migration

### Claude's Discretion

- tRPC client configuration details (batch size, retry policy, stale time)
- Component refactoring approach during localStorage -> tRPC migration
- MSW handler structure and test data fixtures
- Error boundary/loading state patterns for tRPC queries

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                       | Research Support                                                                                                                       |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| AUTHZ-01 | SAML login endpoint (`/auth/saml/login`) redirects to Keycloak                    | `saml.strategy.ts` already creates strategy; need Express route calling `passport.authenticate('saml')`                                |
| AUTHZ-02 | SAML callback endpoint processes assertion, creates/updates user, sets JWT cookie | `auth.controller.ts` has `issueSessionCookie()`; need POST route at `/auth/saml/callback`, user upsert via Prisma                      |
| AUTHZ-03 | tRPC middleware validates JWT and injects UserSession into context                | `trpc.context.ts` has placeholder comment `// Phase 6: extract JWT from cookie`; use `auth.controller.ts` verifySessionToken           |
| AUTHZ-04 | tRPC middleware enforces role-based access per procedure                          | Already done in `trpc.middleware.ts` (`protectedProcedure`, `headProcedure`); verify with real sessions                                |
| AUTHZ-05 | Dev bypass mode provides hardcoded session for local development                  | Already implemented in `trpc.context.ts` (`AUTH_DEV_MODE=true` returns DEV_SESSION); needs cookie-based bypass for frontend middleware |
| AUTHZ-06 | Logout endpoint clears JWT cookie                                                 | New route `/auth/logout` that clears the session cookie and redirects                                                                  |
| FE-01    | tRPC client configured with httpBatchLink pointing to API                         | Install `@trpc/client`, `@trpc/react-query`/`@trpc/tanstack-react-query`, `@tanstack/react-query`; create `trpc.ts`                    |
| FE-02    | Lead report form uses tRPC mutations instead of localStorage                      | Replace `section-storage.ts` imports with `trpc.reports.saveDraft.useMutation()` etc.                                                  |
| FE-03    | Head dashboard fetches real submission statuses via tRPC                          | Replace `buildSubmissionDashboardRows()` with `trpc.review.dashboard.useQuery()`                                                       |
| FE-04    | Assembled report review page loads data from API                                  | Replace `buildDraftAssembledReport()` with `trpc.review.assembledReport.useQuery()`                                                    |
| FE-05    | Publication flow calls API to publish report                                      | Replace `publishReportSnapshot()` with `trpc.review.publish.useMutation()`                                                             |
| FE-06    | Published report page loads from API                                              | Replace `readPublishedReport()` with `trpc.archive.detail.useQuery()`                                                                  |
| FE-07    | Admin panel CRUD operations call API endpoints                                    | Replace all `admin-runtime.ts` helpers with `trpc.admin.*` mutations                                                                   |
| FE-08    | Archive/history pages load from API                                               | Replace `listArchiveReportSummaries()` with `trpc.archive.list.useQuery()`                                                             |
| FE-09    | PDF export triggers async job via API and polls for completion                    | Replace `requestPdfExport()`/`completePdfExportJob()` with `trpc.pdfExport.request.useMutation()` + polling                            |
| FE-10    | localStorage helpers and demo data files removed                                  | Delete `section-storage.ts`, `report-runtime.ts`, `admin-runtime.ts`, `dev-session.ts`, `use-browser-state.ts`, `demo-section.ts`      |
| QA-02    | Fix 24 failing frontend tests (userEvent.setup crash / document not defined)      | Configure Vitest with `environment: 'jsdom'`; add MSW handlers for tRPC endpoints                                                      |
| QA-03    | TypeScript typecheck clean across entire monorepo                                 | Currently clean; maintain after adding new packages and rewriting components                                                           |

</phase_requirements>

## Standard Stack

### Core (to install)

| Library                      | Version | Purpose                                     | Why Standard                                                            |
| ---------------------------- | ------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `@trpc/client`               | 11.16.0 | tRPC client for httpBatchLink               | Required peer of @trpc/react-query                                      |
| `@trpc/tanstack-react-query` | 11.16.0 | tRPC + TanStack Query integration (new API) | Official tRPC v11 React integration; replaces older `@trpc/react-query` |
| `@tanstack/react-query`      | 5.97.0  | Server state management                     | Required by tRPC React integration                                      |
| `msw`                        | 2.13.2  | Test HTTP mocking                           | Network-level interception for tRPC calls in Vitest                     |

**Important version note on tRPC React integration:** tRPC v11 offers TWO React Query integrations:

1. `@trpc/react-query` (classic) -- uses `trpc.reports.getActive.useQuery()` syntax
2. `@trpc/tanstack-react-query` (new) -- uses `useQuery(trpc.reports.getActive.queryOptions())` syntax

The user's D-05 says `trpc.reports.getActive.useQuery()` syntax, which is the **classic** `@trpc/react-query` pattern. Use `@trpc/react-query` to match the user's stated API. If the classic package is deprecated or unavailable at install time, the new `@trpc/tanstack-react-query` with its slightly different syntax is the fallback.

### Already Installed (no action needed)

| Library                       | Version | Purpose                     |
| ----------------------------- | ------- | --------------------------- |
| `@trpc/server`                | 11.16.0 | Backend tRPC (in apps/api)  |
| `@node-saml/passport-saml`    | 5.1.0   | SAML strategy               |
| `passport`                    | 0.7.0   | Auth middleware             |
| `passport-jwt`                | 4.0.1   | JWT strategy                |
| `jsonwebtoken`                | 9.0.2   | JWT sign/verify             |
| `cookie`                      | 1.0.2   | Cookie parsing              |
| `cookie-parser`               | 1.4.7   | Express cookie middleware   |
| `@testing-library/react`      | 16.3.0  | Component testing           |
| `@testing-library/user-event` | 14.6.1  | User interaction simulation |
| `jsdom`                       | 26.1.0  | DOM environment for Vitest  |
| `vitest`                      | 3.2.4   | Test runner                 |
| `@playwright/test`            | 1.55.0  | E2E testing                 |

### Installation

```bash
# In apps/web
cd apps/web
pnpm add @trpc/client@^11.16.0 @trpc/react-query@^11.16.0 @tanstack/react-query@^5.97.0

# Dev dependencies for testing
pnpm add -D msw@^2.13.0
```

## Architecture Patterns

### Auth Flow Architecture

```text
User -> Next.js /login -> redirect to NestJS /auth/saml/login
                              |
                              v
                    Keycloak SAML IdP (login page)
                              |
                              v
                    POST NestJS /auth/saml/callback
                              |
                    passport.authenticate('saml')
                              |
                    saml.strategy.ts verify callback
                              |
                    Find/create User in DB (by samlId)
                              |
                    auth.controller.ts issueSessionCookie()
                              |
                              v
                    Set-Cookie: customreport_session=<JWT>
                    302 Redirect -> Next.js frontend (/)
                              |
                              v
                    Next.js middleware reads cookie -> allow access
                    tRPC context reads cookie -> inject UserSession
```

### SAML Route Mounting (NestJS + Express)

The auth routes must be mounted on the raw Express app, NOT as NestJS controllers, because:

1. Passport SAML needs Express middleware chain (body-parser -> passport.authenticate)
2. tRPC already uses raw Express middleware mounting (same pattern in main.ts)
3. The SAML callback is a POST with `application/x-www-form-urlencoded` body

```typescript
// Pattern: Mount auth routes in main.ts alongside tRPC
const expressApp = app.getHttpAdapter().getInstance();

// SAML login redirect
expressApp.get("/auth/saml/login", passport.authenticate("saml"));

// SAML callback (POST from Keycloak)
expressApp.post(
  "/auth/saml/callback",
  express.urlencoded({ extended: false }),
  passport.authenticate("saml", { session: false }),
  async (req, res) => {
    // req.user populated by saml.strategy verify callback
    // Find or create user in DB by samlId
    // Issue JWT cookie
    // Redirect to frontend
  },
);

// Logout
expressApp.post("/auth/logout", (req, res) => {
  res.clearCookie("customreport_session");
  res.redirect("/");
});
```

### tRPC Context Factory (Phase 6 completion)

```typescript
// trpc.context.ts - complete the Phase 6 placeholder
export function createContextFactory(app: INestApplication) {
  const authController = createAuthController(process.env);

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    // Dev bypass (already exists)
    if (process.env["AUTH_DEV_MODE"] === "true") {
      return { session: DEV_SESSION };
    }

    // Extract JWT from cookie
    const token = req.cookies?.["customreport_session"];
    if (!token) {
      return { session: null };
    }

    try {
      const session = authController.verifySessionToken(token);
      return { session };
    } catch {
      return { session: null };
    }
  };
}
```

### tRPC Client Setup Pattern (classic @trpc/react-query)

```typescript
// apps/web/src/lib/trpc.ts
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "@customreport/api/trpc"; // or import type from shared

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/trpc",
        fetch: (url, options) =>
          fetch(url, { ...options, credentials: "include" }),
      }),
    ],
  });
}
```

```typescript
// apps/web/src/app/layout.tsx (TRPCProvider wrapper)
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { trpc, createTRPCClient } from '../lib/trpc';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(createTRPCClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### Page Migration Pattern (localStorage -> tRPC)

```text
BEFORE (localStorage):
  useBrowserState(default, readFromLocalStorage)
  -> handleSave: persistToLocalStorage(data)
  -> handleSubmit: persistToLocalStorage(data)

AFTER (tRPC):
  trpc.reports.getActive.useQuery()
  -> handleSave: trpc.reports.saveDraft.useMutation()
  -> handleSubmit: trpc.reports.submit.useMutation()
```

Each page follows the same pattern:

1. Replace `useBrowserState` + localStorage reader with `trpc.*.useQuery()`
2. Replace localStorage persist calls with `trpc.*.useMutation()`
3. Add loading/error states using TanStack Query's `isLoading`, `isError`, `error`
4. Remove all localStorage imports

### MSW Test Setup Pattern

```typescript
// apps/web/src/test/msw-handlers.ts
import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3001/trpc';

export const handlers = [
  // tRPC uses POST for batch requests
  http.post(`${API_URL}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const procedure = url.pathname.replace('/trpc/', '');

    // Route to mock data based on procedure name
    // Example: reports.getActive -> return mock section data
    return HttpResponse.json({
      result: { data: /* mock data */ },
    });
  }),
];
```

```typescript
// apps/web/vitest.setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./src/test/msw-handlers";
import { afterAll, afterEach, beforeAll } from "vitest";

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Anti-Patterns to Avoid

- **Do NOT use NestJS guards for auth on tRPC routes.** Guards are bypassed when tRPC is mounted as raw Express middleware. All auth enforcement is in tRPC middleware (`protectedProcedure`, `headProcedure`) -- already done in Phase 5.
- **Do NOT mix localStorage and tRPC in the same component.** Big-bang replacement per D-08. No hybrid state.
- **Do NOT import server-side auth code into client components.** The `AppRouter` type must be imported via `import type` only. The tRPC client infers types without bundling server code.
- **Do NOT use `@trpc/next`** (`@trpc/next` is for Pages Router). For App Router, use `@trpc/react-query` with a client-side Provider.

## Don't Hand-Roll

| Problem                      | Don't Build        | Use Instead                                            | Why                                                                        |
| ---------------------------- | ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| HTTP test mocking            | Custom fetch mocks | MSW `setupServer`                                      | Intercepts at network level; tRPC batch format is complex to mock manually |
| Query caching & invalidation | Custom cache layer | TanStack Query via `@trpc/react-query`                 | Handles stale-while-revalidate, retry, deduplication out of the box        |
| SAML assertion parsing       | Custom XML parser  | `@node-saml/passport-saml` (already installed)         | SAML XML is deceptively complex (signatures, conditions, namespaces)       |
| JWT session management       | Custom token logic | `auth.controller.ts` `createJwtSigner` (already built) | Handles sign/verify/cookie serialization with Zod validation               |
| User upsert on SAML login    | Raw SQL            | Prisma `upsert` with `samlId` unique constraint        | Atomic find-or-create; handles race conditions                             |

## Common Pitfalls

### Pitfall 1: tRPC Batch Request Format in MSW

**What goes wrong:** MSW handlers for tRPC must handle the batch format. tRPC `httpBatchLink` sends requests as a single POST to `/trpc/procedure1,procedure2` with a JSON array body. Naive MSW handlers that expect individual requests miss batched calls.

**Why it happens:** tRPC batches multiple concurrent queries into one HTTP request to reduce round-trips. The URL contains comma-separated procedure names.

**How to avoid:** MSW handlers must parse the batch URL format. For queries, tRPC uses GET with query params `?batch=1&input=...`. For mutations, POST with JSON array. Test with `httpBatchLink` active, not `httpLink`.

**Warning signs:** Tests pass individually but fail when multiple components query simultaneously.

### Pitfall 2: SAML Callback Requires Body Parser BEFORE Passport

**What goes wrong:** The SAML callback POST from Keycloak sends `application/x-www-form-urlencoded` body. If `express.urlencoded()` middleware is not applied before `passport.authenticate('saml')`, the SAML response is empty and authentication fails silently.

**Why it happens:** NestJS uses `body-parser` for JSON by default but not for URL-encoded forms on custom routes. The raw Express route needs explicit middleware.

**How to avoid:** Mount `express.urlencoded({ extended: false })` on the `/auth/saml/callback` route BEFORE `passport.authenticate`.

**Warning signs:** Keycloak shows successful login, but NestJS logs "SAML profile is missing" error.

### Pitfall 3: Cookie Domain Mismatch Between API and Frontend

**What goes wrong:** In development, Next.js runs on port 3000 and NestJS on port 3001. The JWT cookie set by NestJS on `localhost:3001` is readable by Next.js on `localhost:3000` because cookies on `localhost` are shared across ports. But in production with different subdomains, cookies are not shared.

**Why it happens:** Same-origin policy treats different ports on localhost as same-origin for cookies, but different subdomains require explicit `domain` in cookie options.

**How to avoid:** Set cookie `path: '/'` (already done in auth.controller.ts). For production, ensure API and frontend are on same domain (path-based routing via reverse proxy) OR set explicit cookie `domain`.

**Warning signs:** Works in development, breaks in production. User logs in successfully but appears unauthenticated on frontend.

### Pitfall 4: Vitest jsdom Environment Not Configured

**What goes wrong:** Frontend component tests fail with `ReferenceError: document is not defined`. This is the CURRENT state of all 24 failing frontend tests.

**Why it happens:** The `test` script in `apps/web/package.json` passes `--environment jsdom` flag, but when running from monorepo root via `turbo run test`, the individual test files don't have the jsdom environment annotation and Vitest defaults to `node` environment.

**How to avoid:** Either add `// @vitest-environment jsdom` directive at the top of each test file, or create a `vitest.config.ts` in `apps/web/` with `environment: 'jsdom'` as default.

**Warning signs:** Tests pass with `pnpm -F @customreport/web test` but fail with `pnpm test` from root.

### Pitfall 5: AppRouter Type Export for Client-Side Import

**What goes wrong:** The tRPC client needs the `AppRouter` type for type inference. But `AppRouter` is defined in `apps/api` which depends on NestJS, Prisma, and server-only code. Importing it directly into `apps/web` pulls in server dependencies and breaks the build.

**Why it happens:** TypeScript follows type imports to their source files, and bundlers may try to bundle the entire dependency tree.

**How to avoid:** Export `AppRouter` type from a path that only re-exports the type, or use the shared package. The current `packages/shared/src/trpc/router.ts` has a `SharedRouter` type but it only covers 4 procedures. The full `AppRouter` type needs to be available to the web app via `import type`.

**Recommended approach:** Create `apps/api/src/infrastructure/trpc/index.ts` that exports `type AppRouter` and configure the web app's tsconfig `paths` to resolve it, OR re-export the type through `packages/shared`.

**Warning signs:** Build error in Next.js: "Module not found: Can't resolve '@nestjs/common'" from a client component.

### Pitfall 6: Passport Session Serialization Not Needed

**What goes wrong:** Passport tries to serialize/deserialize user to session, but we use JWT cookies (stateless), not server sessions. Without `serializeUser`/`deserializeUser`, Passport throws "Failed to serialize user into session".

**Why it happens:** Default Passport behavior assumes session-based auth.

**How to avoid:** Pass `{ session: false }` to `passport.authenticate('saml', { session: false })`. Already hinted in the code pattern above.

**Warning signs:** "Failed to serialize user into session" error on SAML callback.

### Pitfall 7: ENV Schema Missing Auth Variables

**What goes wrong:** `env.schema.ts` currently validates only `DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `AUTH_DEV_MODE`, `LOG_LEVEL`, `LOG_DIR`. The SAML-related variables (`AUTH_JWT_SECRET`, `KEYCLOAK_SAML_CALLBACK_URL`, `KEYCLOAK_SAML_ENTRY_POINT`, `KEYCLOAK_SAML_ISSUER`, `KEYCLOAK_SAML_CERT`) are NOT in the schema. They are read directly from `process.env` in `saml.strategy.ts` and `auth.controller.ts`.

**Why it happens:** Auth code was written in Phase 1 before the env validation was added in Phase 5.

**How to avoid:** Add auth-related env vars to `env.schema.ts` with conditional validation (required when `AUTH_DEV_MODE` is false, optional when true).

**Warning signs:** Application starts successfully with `AUTH_DEV_MODE=true` but crashes in production when SAML vars are missing.

## Code Examples

### SAML User Upsert Pattern

```typescript
// In SAML callback handler
// req.user comes from saml.strategy.ts verify callback:
// { samlId, email, displayName, role }

const user = await prisma.user.upsert({
  where: { samlId: req.user.samlId },
  update: {
    email: req.user.email,
    name: req.user.displayName,
  },
  create: {
    samlId: req.user.samlId,
    email: req.user.email,
    name: req.user.displayName,
    role: req.user.role, // from SAML attribute mapping
  },
  include: {
    authoredReportSections: {
      where: {
        report: { status: "draft" },
      },
      select: { id: true, reportId: true },
      take: 1,
    },
  },
});

// Build UserSession from DB user
const session: UserSession = {
  userId: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  activeReportId: user.authoredReportSections[0]?.reportId ?? null,
  activeReportSectionId: user.authoredReportSections[0]?.id ?? null,
};
```

### Vitest Config for jsdom

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@customreport/shared": path.resolve(
        __dirname,
        "../../packages/shared/src",
      ),
    },
  },
});
```

### Dev Bypass for Frontend Middleware

```typescript
// apps/web/src/middleware.ts - update for dev mode
export function middleware(request: NextRequest) {
  // Dev bypass: skip auth check entirely
  if (process.env.AUTH_DEV_MODE === "true") {
    return NextResponse.next();
  }

  // Production: check for session cookie
  const cookies = Object.fromEntries(
    request.cookies.getAll().map((c) => [c.name, c.value]),
  );

  if (shouldRedirectToLogin(request.nextUrl.pathname, cookies)) {
    // Redirect to NestJS SAML login (not hardcoded localhost)
    const loginUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/saml/login`;
    return NextResponse.redirect(
      new URL(buildLoginRedirect(request.url, loginUrl)),
    );
  }

  return NextResponse.next();
}
```

## State of the Art

| Old Approach                  | Current Approach                   | When Changed         | Impact                                                                   |
| ----------------------------- | ---------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `@trpc/react-query` (classic) | `@trpc/tanstack-react-query` (new) | tRPC v11 (2024-2025) | New API is more TanStack-native; classic still maintained                |
| `passport-saml`               | `@node-saml/passport-saml`         | 2023 (fork)          | Package renamed under @node-saml org; v5 requires explicit `callbackUrl` |
| MSW v1 (`rest.get()`)         | MSW v2 (`http.get()`)              | 2024                 | New API uses `http`/`HttpResponse` instead of `rest`/`ctx`               |
| Vitest `globals: true`        | Explicit imports                   | 2024-2025            | Best practice is explicit `import { describe, it } from 'vitest'`        |

**Note on D-05 vs latest tRPC:** The user specified `trpc.reports.getActive.useQuery()` syntax which is the classic `@trpc/react-query` API. The newer `@trpc/tanstack-react-query` uses `useQuery(trpc.reports.getActive.queryOptions())`. Both are valid in tRPC v11. The classic API is simpler and matches the user's stated preference.

## Open Questions

1. **AppRouter type sharing**
   - What we know: `AppRouter` is defined in `apps/api` and the tRPC client needs it for type inference. A partial `SharedRouter` exists in `packages/shared/src/trpc/router.ts` covering only 4 of 7+ namespaces.
   - What's unclear: Whether to extend the shared router to cover all namespaces, or use TypeScript project references to import the type directly from `apps/api`.
   - Recommendation: Use TypeScript `paths` alias in `apps/web/tsconfig.json` to reference the `AppRouter` type from `apps/api` via `import type`. This avoids duplicating the router definition and stays in sync automatically.

2. **SAML role attribute mapping**
   - What we know: `saml.strategy.ts` extracts `profile.role` from SAML assertion. Keycloak must be configured to include a `role` attribute in the SAML response.
   - What's unclear: Exact Keycloak attribute mapping configuration.
   - Recommendation: Default to `'viewer'` role if the SAML assertion doesn't include a role attribute (already done in strategy: `profile.role ?? 'viewer'`). Document required Keycloak configuration separately.

3. **Active report/section resolution during login**
   - What we know: `UserSession` includes `activeReportId` and `activeReportSectionId`. These must be populated during SAML callback by querying the database for the current active report period.
   - What's unclear: Whether to query for the latest draft report or use a specific "current period" concept.
   - Recommendation: Query for the most recent report with status `draft`, and find the user's section within it. If no draft report exists, set both to `null`.

## Environment Availability

| Dependency | Required By                            | Available                | Version | Fallback                    |
| ---------- | -------------------------------------- | ------------------------ | ------- | --------------------------- |
| Node.js    | Runtime                                | Yes                      | 25.9.0  | --                          |
| pnpm       | Package manager                        | Yes                      | 9.15.0  | --                          |
| Docker     | Integration tests (PGlite alternative) | Yes                      | 29.2.1  | PGlite for unit tests       |
| PostgreSQL | Data persistence                       | Yes (via Docker)         | --      | --                          |
| Keycloak   | SAML IdP                               | No (not running locally) | --      | `AUTH_DEV_MODE=true` bypass |

**Missing dependencies with no fallback:**

- None -- all blocking dependencies are available or have dev bypass

**Missing dependencies with fallback:**

- Keycloak is not running locally, but `AUTH_DEV_MODE=true` provides a complete bypass for development and testing

## Sources

### Primary (HIGH confidence)

- Codebase analysis: `apps/api/src/modules/auth/*.ts` -- existing auth implementation
- Codebase analysis: `apps/api/src/infrastructure/trpc/*.ts` -- existing tRPC backend
- Codebase analysis: `apps/web/src/**` -- all frontend components and localStorage usage
- Codebase analysis: Test failure output from `pnpm vitest run` -- 32 failing tests identified
- [tRPC TanStack React Query Setup](https://trpc.io/docs/client/tanstack-react-query/setup) -- official docs fetched via WebFetch
- [tRPC React Query Integration](https://trpc.io/docs/client/react/setup) -- official classic API docs

### Secondary (MEDIUM confidence)

- [MSW v2 Quick Start](https://mswjs.io/docs/quick-start/) -- MSW setup patterns
- [passport-saml v5 breaking changes](https://github.com/node-saml/passport-saml/issues/909) -- callbackUrl required
- [Vitest Mocking Requests](https://vitest.dev/guide/mocking/requests) -- MSW + Vitest integration
- npm registry version checks for all packages (verified 2026-04-10)

### Tertiary (LOW confidence)

- reference-app reference (OIDC, not SAML) -- limited applicability, only NestJS patterns transferable

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all packages verified on npm, versions confirmed
- Architecture: HIGH -- existing code provides clear integration points with explicit Phase 6 placeholders
- Pitfalls: HIGH -- 5 of 7 pitfalls observed directly in current codebase state; remaining 2 from documented web standards

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable ecosystem, 30-day validity)
