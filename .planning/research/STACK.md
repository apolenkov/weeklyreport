# Technology Stack Additions for v5.0

**Project:** CustomReport
**Milestone:** v5.0 Production Integration
**Researched:** 2026-04-25
**Overall confidence:** HIGH

---

## Scope

This document covers ONLY the new libraries, patterns, and integration concerns
for v5.0. It does NOT re-research the base stack (NestJS 11, Prisma 7, Zod 4,
tRPC 11, BullMQ, Next.js 16, shadcn/ui, Tailwind v4, Vitest 4, Playwright 1.55).

**v5.0 adds five capability areas:**

1. tRPC client wiring (migrate to React Compiler-safe package)
2. Production logging with pino + file rotation + correlation IDs
3. Correlation ID propagation via AsyncLocalStorage
4. Playwright dual-server config for real API integration tests
5. Session middleware / auth guards (no new packages -- wiring only)

---

## 1. tRPC Client Migration: @trpc/tanstack-react-query

### New Packages

| Package | Version | Install To | Purpose |
|---------|---------|------------|---------|
| **@trpc/tanstack-react-query** | ^11.16.0 | apps/web | New TanStack-native tRPC integration |
| **client-only** | ^0.0.1 | apps/web | Required by tRPC RSC setup (client boundary marker) |
| **server-only** | ^0.0.1 | apps/web | Required by tRPC RSC setup (server boundary marker) |

### Package to Remove

| Package | Why Remove |
|---------|------------|
| **@trpc/react-query** | Breaks under React Compiler. Creates proxy hooks that violate rules of hooks. |

### Why This Is a Migration, Not Just Wiring

The project already has `babel-plugin-react-compiler` and `eslint-plugin-react-compiler`
installed. The classic `@trpc/react-query` package creates proxy-based hooks
(`trpc.report.list.useQuery()`) that:

- Break under React Compiler (hooks-as-props pattern)
- Violate rules of hooks (dynamic hook creation)
- Are explicitly deprecated in favor of `@trpc/tanstack-react-query`

The new package uses a `queryOptions()` factory pattern that is React Compiler-safe
and TanStack Query-native. Both packages can coexist during migration, but the
classic one must be fully removed before enabling React Compiler optimizations.

### Migration Pattern

```typescript
// OLD (classic @trpc/react-query) -- current apps/web/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
export const trpc = createTRPCReact<AppRouter>();
// Usage: trpc.report.list.useQuery()

// NEW (@trpc/tanstack-react-query)
// NOTE: verify exact import names against @trpc/tanstack-react-query package exports during implementation
import { createTRPCClient } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
export const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient });
// Usage: useQuery(trpc.report.list.queryOptions())
```

### TRPCProvider for Next.js 16 App Router

Create a `'use client'` provider component that wraps `QueryClientProvider`.

**Files to create:**
- `apps/web/src/trpc/query-client.ts` -- QueryClient factory with SSR-safe defaults
- `apps/web/src/trpc/client.tsx` -- `'use client'` TRPCReactProvider component
- `apps/web/src/trpc/server.ts` -- `'server-only'` prefetch utilities (optional, for RSC optimization later)

**Key QueryClient settings:**
- `staleTime: 30 * 1000` -- prevents immediate refetch after SSR hydration
- `shouldDehydrateQuery` -- dehydrate pending queries for streaming
- `credentials: 'include'` on httpBatchLink (already in existing code)
- `superjson` transformer (already in existing code)

**Mount location:** `apps/web/src/app/(app)/layout.tsx` (the authenticated layout),
not the root layout. The login page does not need tRPC.

### Packages That Stay Unchanged

| Package | Version | Reason |
|---------|---------|--------|
| `@trpc/client` | ^11.16.0 | Shared by both old and new integrations |
| `@trpc/server` | ^11.16.0 | Backend, no change |
| `@tanstack/react-query` | ^5.97.0 | Compatible, no version bump needed |
| `superjson` | ^2.2.6 | Still used as transformer on both client and server |

**Confidence:** HIGH -- official tRPC docs recommend this migration, React Compiler incompatibility is documented.

---

## 2. Production Logging: pino + pino-roll

### New Packages

| Package | Version | Install To | Purpose |
|---------|---------|------------|---------|
| **pino** | ^10.3.1 | apps/api | Structured JSON logger with worker-thread transports |
| **pino-roll** | ^4.0.0 | apps/api | File rotation transport (daily + size-based + retention) |
| **pino-pretty** | ^13.0.0 | apps/api (devDep) | Human-readable dev output |

### Why Replace the Custom AppLogger Internals

The existing `AppLoggerImpl` at `apps/api/src/lib/logger.ts` has four
production blockers:

1. **Synchronous file writes** -- `appendFileSync()` blocks the event loop on every log call
2. **O(n) directory scan on every write** -- `pruneOldFiles()` calls `readdirSync()` + sort on every single log line
3. **No compression** -- old log files sit uncompressed on disk
4. **No size-based rotation** -- only date-based naming, no rotation on file size

pino solves all of these:
- Writes to a worker thread via `pino.transport()` -- zero main-thread blocking
- pino-roll handles rotation in the worker thread (daily + size-based + retention limit)
- Structured JSON output is already the format the custom logger produces

### Integration Approach: Keep the AppLogger Interface

The `AppLogger` interface is used throughout the API codebase. Replacing internals
without changing the interface means zero changes in any consuming module.

```typescript
// apps/api/src/lib/logger.ts -- rewrite internals, keep interface
import pino from 'pino';
import { join } from 'node:path';

export function createAppLogger(options: LoggerOptions = {}): AppLogger {
  const targets: pino.TransportTargetOptions[] = [
    // Always log to stdout (Docker captures this)
    {
      target: 'pino/file',
      options: { destination: 1 },
      level: options.minLevel ?? 'info',
    },
  ];

  // File rotation when logDir is configured
  if (options.logDir) {
    targets.push({
      target: 'pino-roll',
      options: {
        file: join(options.logDir, 'customreport'),
        frequency: 'daily',
        size: '50m',
        limit: { count: 14 },
        mkdir: true,
        dateFormat: 'yyyy-MM-dd',
      },
      level: options.minLevel ?? 'info',
    });
  }

  // Dev-only pretty printing
  if (process.env.NODE_ENV === 'development') {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'debug',
    });
  }

  const pinoLogger = pino({
    level: options.minLevel ?? 'info',
    transport: { targets },
  });

  return new PinoAppLoggerAdapter(pinoLogger);
}
```

### pino-roll Configuration Options

| Option | Value | Purpose |
|--------|-------|---------|
| `file` | `join(logDir, 'customreport')` | Base filename. Rotation appends date + counter. |
| `frequency` | `'daily'` | Rotate at midnight. Also supports `'hourly'`, `'weekly'`, or milliseconds. |
| `size` | `'50m'` | Rotate when file exceeds 50MB. Accepts `k`, `m`, `g` suffixes. |
| `limit.count` | `14` | Keep 14 rotated files + 1 active. Older files auto-deleted. |
| `mkdir` | `true` | Create log directory if missing. |
| `dateFormat` | `'yyyy-MM-dd'` | Filename pattern: `customreport.2026-04-25.1.log` |

**Note:** pino-roll does NOT support gzip compression. If compression is needed
later, add a cron job or use `pino-transport-rotating-file` (lower adoption).
For v5.0, uncompressed daily rotation with 14-file retention is sufficient.

### Compatibility Note

pino-roll 4.0.0 (Oct 2025) + pino 10.3.1 (Feb 2026): Both use NDJSON transport
protocol and are maintained by the same author (Matteo Collina). No explicit
compatibility statement found in docs. **Verify in dev before deploying.**

**Confidence:** HIGH (approach), MEDIUM (pino 10 + pino-roll 4 exact compat)

---

## 3. Correlation IDs: nestjs-cls

### New Package

| Package | Version | Install To | Purpose |
|---------|---------|------------|---------|
| **nestjs-cls** | ^6.2.0 | apps/api | Request-scoped context via AsyncLocalStorage |

### Why nestjs-cls, Not Manual AsyncLocalStorage

- Integrates with NestJS DI -- inject `ClsService` anywhere, no manual store threading
- `global: true` makes it available to all modules without per-module imports
- Handles context setup/teardown automatically via middleware
- 500K+ weekly npm downloads, actively maintained
- Referenced in official NestJS docs (`docs.nestjs.com/recipes/async-local-storage`)

### Integration with Existing Code

**Step 1: Register ClsModule (must be FIRST import in app.module.ts):**

```typescript
// apps/api/src/app.module.ts
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    // ... other modules after CLS
  ],
})
```

**Step 2: Update CorrelationIdMiddleware to store in CLS:**

The existing middleware at `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`
already extracts/generates the correlation ID and sets the response header.
Add CLS storage:

```typescript
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-request-id'] as string) ?? randomUUID();
    req.headers['x-request-id'] = correlationId;
    res.setHeader('x-request-id', correlationId);
    this.cls.set('correlationId', correlationId);
    next();
  }
}
```

**Step 3: Logger reads from CLS on every log call:**

```typescript
// In PinoAppLoggerAdapter, enrich every log entry with correlationId
private getCorrelationId(): string | undefined {
  try {
    return this.cls?.get('correlationId');
  } catch {
    return undefined; // Outside request context (startup, cron jobs)
  }
}
```

**tRPC context integration:** The CLS store is available in the tRPC
`createContext` factory since it runs within the Express request lifecycle.
The correlation ID appears automatically in all tRPC handler logs without
any changes to `trpc.context.ts`.

**Confidence:** HIGH

---

## 4. Playwright Dual-Server Config for Real API Tests

### No New Packages Needed

Playwright ^1.55.0 is already installed. The change is configuration, not packages.

### Key Change: webServer as Array

The current `apps/web/playwright.config.ts` starts only the Next.js dev server.
For real API integration tests, it needs a dual-server array:

```typescript
webServer: [
  // API server (must start first)
  {
    command: `pnpm --filter @customreport/api exec tsx src/main.ts`,
    url: `http://127.0.0.1:${API_PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://...',
      AUTH_DEV_MODE: 'true',
      PORT: String(API_PORT),
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
    },
  },
  // Web server (depends on API being up)
  {
    command: `pnpm --filter @customreport/web exec next dev -p ${WEB_PORT}`,
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
      AUTH_DEV_MODE: 'true',
      NODE_ENV: 'test',
    },
  },
],
```

### Database Seeding: Expand auth.setup.ts, NOT globalSetup

The existing `auth.setup.ts` project dependency pattern is already correct.
Expand it rather than introducing `globalSetup`, because:

- `globalSetup` runs outside the test runner -- no fixtures, no `page`/`request`
  objects, no trace viewer integration, no visibility in HTML report
- Database connections in `globalSetup` get terminated when the function ends
- Project dependencies give full Playwright integration (traces, HTML report, fixtures)

**Pattern:**

```typescript
// e2e/auth.setup.ts
setup('seed database', async ({ request }) => {
  // Option A: Call a seed endpoint
  await request.post(`http://127.0.0.1:${API_PORT}/api/seed`);

  // Option B: Run prisma seed via child_process
  // execSync('pnpm --filter @customreport/api exec prisma db seed');
});

setup('authenticate as head', async ({ page }) => {
  await page.goto('/auth/dev-login?role=head');
  await page.context().storageState({ path: authFile('head') });
});
```

### Existing Fixtures Stay Unchanged

The role-scoped fixtures in `apps/web/e2e/fixtures.ts` (`leadPage`, `headPage`)
are already wired to use `storageState` from `.auth/*.json` files. No changes needed.

**Confidence:** HIGH

---

## 5. Session Middleware / Auth Guards

### No New Packages Needed

All auth packages are already installed:

| Package | Version | Status |
|---------|---------|--------|
| `@nestjs/passport` | ^11.0.5 | Installed |
| `passport-jwt` | ^4.0.1 | Installed |
| `jsonwebtoken` | ^9.0.2 | Installed |
| `cookie-parser` | ^1.4.7 | Installed |
| `@node-saml/passport-saml` | ^5.1.0 | Installed |

### What Already Exists

The backend auth infrastructure is complete:
- `trpc.context.ts` extracts JWT from `customreport_session` cookie, verifies via `authController.verifySessionToken()`, falls back to DEV_SESSION when `AUTH_DEV_MODE=true`
- `trpc.middleware.ts` has `protectedProcedure` (requires session) and `headProcedure` (requires head role)
- `auth.routes.ts` mounts SAML login/callback/logout + dev-login

### What's Needed (Application-Level, Not Stack-Level)

1. **Next.js `proxy.ts`** (replaces `middleware.ts` in Next.js 16) to check cookie presence and redirect to `/login`
2. **Forward cookies from SSR requests** to API when prefetching
3. **`AUTH_DEV_MODE=true`** in dev `.env` for local development without Keycloak

**Confidence:** HIGH -- all code exists, just needs wiring

---

## What NOT to Add

| Library | Why Skip |
|---------|----------|
| **nestjs-pino** | Requires restructuring DI around its `LoggerModule`. The custom `AppLogger` interface is already used throughout the API. Wrapping pino directly is simpler and preserves the existing interface contract. |
| **winston** | 10x slower than pino in benchmarks. Larger bundle. pino is the Node.js standard for structured JSON logging. |
| **cls-hooked** | Deprecated. Uses monkey-patched async hooks. `nestjs-cls` uses native `AsyncLocalStorage` (stable since Node 16). |
| **@trpc/next** | Pages Router only. This project uses App Router exclusively. |
| **pino-pretty in production** | Dev-only dependency. In production, structured JSON goes to stdout (Docker captures) and pino-roll handles files. |
| **express-async-errors** | Not needed. NestJS + tRPC handle async error propagation natively. |
| **@tanstack/react-query-devtools** | Optional DX tool. Useful but not v5.0 scope. Can add later. |

---

## Installation Commands

```bash
# From monorepo root

# apps/web -- tRPC migration
pnpm --filter @customreport/web add @trpc/tanstack-react-query@^11.16.0 client-only server-only
pnpm --filter @customreport/web remove @trpc/react-query

# apps/api -- logging + correlation IDs
pnpm --filter @customreport/api add pino@^10.3.1 pino-roll@^4.0.0 nestjs-cls@^6.2.0
pnpm --filter @customreport/api add -D pino-pretty@^13.0.0
```

---

## Integration Points with Existing Code

| Existing File | Change Required | Impact |
|---------------|----------------|--------|
| `apps/web/src/lib/trpc.ts` | Rewrite: `createTRPCReact` -> new queryOptions pattern | Breaking -- all 38 mock data replacements use new query pattern |
| `apps/web/src/app/(app)/layout.tsx` | Add `<TRPCReactProvider>` wrapper | Small -- provider wraps children |
| `apps/web/src/app/layout.tsx` | No change -- provider goes in (app) layout, not root | None |
| `apps/api/src/lib/logger.ts` | Rewrite internals: sync fs -> pino transport. Keep AppLogger interface. | Internal only -- no consumer changes |
| `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts` | Add ClsService injection + `cls.set()` | Small |
| `apps/api/src/app.module.ts` | Add `ClsModule.forRoot()` as FIRST import | Small |
| `apps/api/src/main.ts` | No change -- logger creation call stays identical | None |
| `apps/api/src/infrastructure/trpc/trpc.context.ts` | No change -- CLS is request-scoped, available automatically | None |
| `apps/web/playwright.config.ts` | Expand `webServer` to array (add API server) | Moderate |
| `apps/web/e2e/auth.setup.ts` | Add database seeding step before auth setup | Moderate |
| `apps/web/e2e/fixtures.ts` | No change -- role fixtures already correct | None |

---

## Version Compatibility Matrix

| Package | Version | Requires | Project Status |
|---------|---------|----------|----------------|
| pino | ^10.3.1 | Node.js >= 18 | Node 20+ -- OK |
| pino-roll | ^4.0.0 | pino NDJSON transport | **Verify in dev** -- no explicit compat statement with pino 10 |
| pino-pretty | ^13.0.0 | pino 9+ | OK |
| @trpc/tanstack-react-query | ^11.16.0 | @tanstack/react-query ^5.x, @trpc/client ^11.x | Both present -- OK |
| nestjs-cls | ^6.2.0 | @nestjs/common ^10 or ^11, Node.js >= 16 | NestJS 11 -- OK |
| client-only | ^0.0.1 | React 18+ | React 19 -- OK |
| server-only | ^0.0.1 | React 18+ | React 19 -- OK |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| tRPC client migration | **HIGH** | Official docs, React Compiler incompatibility documented, codemod available |
| pino logger approach | **HIGH** | Industry standard, author-maintained, existing interface preserved |
| pino-roll + pino 10 compat | **MEDIUM** | Same author, same protocol, but no explicit 10.x compat statement found |
| nestjs-cls integration | **HIGH** | Referenced in official NestJS docs, 500K+ weekly downloads |
| Playwright dual-server | **HIGH** | Documented Playwright feature, project pattern already correct |
| Auth guards | **HIGH** | All code already exists, configuration only |

---

## Sources

- [tRPC TanStack React Query Setup](https://trpc.io/docs/client/tanstack-react-query/setup) -- official setup guide
- [tRPC Server Components Guide](https://trpc.io/docs/client/tanstack-react-query/server-components) -- RSC prefetching pattern
- [tRPC Migration from Classic Client](https://trpc.io/docs/client/tanstack-react-query/migrating) -- migration codemod
- [Introducing the new TanStack React Query integration](https://trpc.io/blog/introducing-tanstack-react-query-client) -- React Compiler rationale
- [pino-roll GitHub](https://github.com/mcollina/pino-roll) -- v4.0.0 API, options reference
- [pino Transports Documentation](https://github.com/pinojs/pino/blob/main/docs/transports.md) -- multi-target setup
- [nestjs-cls GitHub](https://github.com/Papooch/nestjs-cls) -- v6.2.0 setup
- [nestjs-cls Quick Start](https://papooch.github.io/nestjs-cls/introduction/quick-start) -- ClsModule registration
- [NestJS AsyncLocalStorage Recipe](https://docs.nestjs.com/recipes/async-local-storage) -- official recommendation
- [Playwright Global Setup and Teardown](https://playwright.dev/docs/test-global-setup-teardown) -- project deps vs globalSetup
- [NestJS Request Context: ALS Blueprint 2026](https://pas7.com.ua/blog/en/nestjs-request-context-als-2026) -- Node.js ALS security patch note
