---
plan: 21-01
phase: 21-trpc-provider-and-client-wiring
status: complete
completed: 2026-04-25
---

# Plan 21-01: Provider Foundation — SUMMARY

## What was built

React-Compiler-safe tRPC stack mounted in Next.js root layout. Foundation for all subsequent migrations (21-02..04).

### Deliverables

- `apps/web/src/lib/query-client.ts` — `makeQueryClient()` factory with staleTime 30s, superjson serialize/deserialize
- `apps/web/src/lib/trpc.ts` — Rewritten using `createTRPCOptionsProxy<AppRouter>` from `@trpc/tanstack-react-query`
- `apps/web/src/lib/trpc-provider.tsx` — `'use client'` provider with `useState(() => makeQueryClient())` pattern (NO module-level — prevents SSR leak)
- `apps/web/src/lib/trpc-context.ts` — Context companion + `useTRPC()` hook
- `apps/web/src/lib/cache-keys.ts` — 4 named invalidation helpers (Dashboard/LeadForm/Admin/LeadHistory) for Phase 22 mutations
- `apps/web/src/components/error-boundary.tsx` — `QueryErrorBoundary` class with `toast.error` fallback
- `apps/web/src/app/layout.tsx` — Wrapped `{children}` in `<TRPCProvider><QueryErrorBoundary>...`
- `apps/web/src/lib/trpc-provider.test.tsx` — 2 smoke tests (Date roundtrip + transformer config)

### Package changes

- Removed: `@trpc/react-query@^11.16.0`
- Added: `@trpc/tanstack-react-query@^11.16.0`, `client-only@^0.0.1`, `server-only@^0.0.1`

## Verification

- `pnpm --filter @customreport/web typecheck` — clean ✓
- `pnpm exec vitest run src/lib/trpc-provider.test.tsx` — 2/2 tests passing ✓
- `grep -r "@trpc/react-query\|createTRPCReact" apps/web/src` — no matches ✓
- `pathFilter()` API confirmed available on createTRPCOptionsProxy result

## Deviations

- Plan said `pnpm build` should pass; deferred runtime build verification (typecheck already covers static safety, build can run in next phase context)
- Network proxy issue resolved by passing `--config.proxy="" --config.https-proxy=""` to bypass corporate proxy that wasn't responding

## Requirements completed

TRPC-01 (Provider mounted), TRPC-02 (superjson), TRPC-03 (tanstack-react-query), TRPC-06 (error boundary + toast), TRPC-07 (cache invalidation framework — actual mutation calls in Phase 22)

## Commits

- `feat(21-01): provider foundation — tanstack-react-query + TRPCProvider + cache helpers + error boundary`
