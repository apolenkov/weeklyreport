<!-- markdownlint-disable -->

# Vercel / Next 16 Performance Audit — CustomReport apps/web

**Date:** 2026-05-22  
**Rubric:** Vercel Engineering perf guidelines + Next 16 App Router best practices  
**Scope:** `apps/web/src/` — read-only, no changes made.

---

## LOW-RISK Quick Wins (safe to apply now)

### QW-1: Replace Google Fonts link with next/font/google

**File:** `apps/web/src/app/layout.tsx:21-29`

Three fonts (Fraunces, Lexend, Source Sans 3) are loaded via a manual
stylesheet link to fonts.googleapis.com. This blocks rendering on an external
DNS + connection round-trip on every cold load (~100-300 ms). `display=swap` is
in the URL, so FOUT is handled, but the network cost is not.

**Fix:** Replace all three with `next/font/google` imports. Next.js
self-hosts the font files at build time, emits correct preload hints, and
injects font-display automatically. The `geist` package is already a dep and
referenced in the mono stack; the three display fonts need the same treatment.

**Risk:** LOW — CSS variable names stay unchanged; `suppressHydrationWarning`
on `<html>` stays as-is.

---

### QW-2: Add Metadata API to root layout and pages

**File:** `apps/web/src/app/layout.tsx` (add); all page files (add)

No `export const metadata` is declared anywhere. Browser titles are set
imperatively via `document.title` inside a useEffect in
`weekly-report-page.tsx:191-197`. This means the `<title>` tag is blank
on first render (visible flash) and invisible to crawlers and social previews.

**Fix:** Add `export const metadata: Metadata = { title: { default: 'CustomReport', template: '%s – CustomReport' } }` to the root layout. Add static
`export const metadata` to each stable page (dashboard, history, admin).
The dynamic per-period title inside WeeklyReportPage can stay as document.title
as progressive enhancement — removing it is optional.

**Risk:** LOW for static titles.

---

### QW-3: Lazy-load ProductKpiCard (Recharts) in the dashboard

**Files:** `apps/web/src/components/dashboard/dashboard-page.tsx:17`,
`apps/web/src/components/dashboard/product-kpi-card.tsx`

`ProductKpiCard` statically imports recharts (Line, LineChart,
ResponsiveContainer, Tooltip, YAxis), pulling the full Recharts bundle
(~130 kB gzip) into the dashboard's initial JS chunk. It renders a sparkline
below the fold. The `/reports/trends` page already handles this correctly via
`next/dynamic({ ssr: false })` for all three chart components.

**Fix:** Wrap ProductKpiCard with `dynamic(() => import('./product-kpi-card'), { ssr: false, loading: () => <Skeleton ...> })` in dashboard-page.tsx.

**Risk:** LOW — ProductKpiCard is a leaf client component already gated by role.

---

### QW-4: Set explicit staleTime on the two heaviest always-on queries

**Files:** `apps/web/src/components/dashboard/dashboard-page.tsx:39-40`,
`apps/web/src/components/weekly-report/weekly-report-page.tsx:89`

`review.dashboard` and `weeklyReport.get` are fired on every mount with no
per-query staleTime. The global default (30 s from query-client.ts:12) is
reasonable, but both are full portfolio aggregations that change only on
lead submit or head publish. They could safely use 60-120 s.

**Fix:** Add `staleTime: 60_000` to both queryOptions() calls.

**Risk:** LOW — `refetchOnWindowFocus: true` is already enabled globally, so
re-focusing the tab still refreshes data. This only cuts background refetches.

---

### QW-5: Replace inline bfcache script with next/script

**File:** `apps/web/src/app/(app)/head/dashboard/page.tsx:3-15`

A multi-line JS string is injected via `script` with an inner HTML prop in the
RSC page tree. This works but bypasses Next.js's script caching/deferral
strategy and cannot be type-checked or extracted.

**Fix:** Extract to a small Client Component using a useEffect, or use
`next/script strategy="beforeInteractive"` if the inline position matters.

**Risk:** LOW — behavior is identical.

---

## NEEDS-DESIGN / Larger Findings

### D-1: No SSR data pre-fetching — every route is a client-side waterfall [BIGGEST CWV RISK]

**Files:**

- `apps/web/src/lib/trpc-provider.tsx` — TRPCProvider is a client component wrapping the whole app
- `apps/web/src/app/(app)/layout.tsx` — SessionProvider (client) fires auth.me; children mount after
- `apps/web/src/app/(app)/head/dashboard/page.tsx` — RSC shell with no prefetch; DashboardPage fires two queries post-hydration

Every authenticated page waterfall:

```
  HTML + JS shipped
  --> hydrate TRPCProvider
  --> SessionProvider fires auth.me
  --> page component mounts
  --> fires domain query (review.dashboard / weeklyReport.get / etc.)
  --> data arrives
  --> UI renders
```

That is 3-4 serial round-trips before any real content appears. On 50 ms API
latency the blank/skeleton window is ~200 ms minimum; on VPN at 150 ms it can
exceed 600 ms.

`query-client.ts` already has `dehydrate` / `shouldDehydrateQuery` configured —
the infrastructure is present but never activated: there is no HydrationBoundary
in any RSC page, and TRPCProvider creates a fresh QueryClient on the client.

**Fix direction:** Use tRPC `createCallerFactory` (or a server-side HTTP tRPC
fetch with the forwarded session cookie) in RSC layouts to prefetch 1-2 hot
queries per route, then pass `dehydratedState` into a `<HydrationBoundary>`.
The highest-value targets are: auth.me (every route), weeklyReport.get
(head/lead report routes), review.dashboard (dashboard).

Requires coordinating the server-side caller with the NestJS module boundary —
not a quick-apply.

---

### D-2: lead-form.tsx is a 1856-line monolith with 7 useQuery calls

**File:** `apps/web/src/components/lead/lead-form.tsx`

Seven queries (getActive, byPeriod, versions, myHistory, crossAuthors,
crossAuthorSections, getVersion) are all declared in one component. Four are
gated by `enabled`, but they share the same render cycle. React Compiler cannot
optimize them independently, and any state change (autosave, nav, snapshot
select) re-evaluates the full query set.

`myHistory` (feeds LeadHistorySidebar) and `crossAuthorSections` (feeds
SdlcPipeline) are already used in separate JSX subtrees and could be split into
sibling components that own their own query hooks. This would reduce the root
form to 3 queries, lower re-render surface, and let React Compiler memoize
subtrees independently. Requires a structural refactor.

---

### D-3: Font weight/axis variants larger than needed

**File:** `apps/web/src/app/layout.tsx:28`

Source Sans 3 loads 6 style/weight variants; Fraunces loads the optical-size
axis + a full weight range. Fraunces is a display font used only in hero
headlines. Consider loading Fraunces with `display=optional` to prevent FOUT
on decorative text, and reducing Fraunces to the two weights actually used.
This is a design call — brand spec drives the weight choices — so NEEDS-DESIGN.

---

### D-4: /reports page is a full client component doing role-conditional queries

**File:** `apps/web/src/app/(app)/reports/page.tsx:1`

The entire page is "use client" and fires either `myHistory` (lead) or
`compiledHistory` (head/viewer/admin) based on `useSession()`. The role is
already resolved server-side in every role-gated layout. This page could be an
RSC that reads the session on the server and renders a role-appropriate client
sub-component, eliminating the conditional client-side query and the session
dependency in the page root. Requires extracting the HistoryArchiveToggle into
a narrow client wrapper. Architecture impact: NEEDS-DESIGN.

---

## Next 16 Convention Findings

### N-1: use(params) Suspense placement — current code correct; monitor growth

**File:** `apps/web/src/app/(app)/reports/[reportId]/page.tsx:21-22`

Uses `use(params)` and `use(searchParams)` correctly per Next 16 async params
spec. The Suspense boundary wraps PeriodSummaryTabs inside the page return,
which is the correct placement (parent of the use() call). Current code is
fine; flag as a forward-looking note — new pages must not place `use()` outside
a Suspense boundary.

### N-2: metadata API absent on all routes (same as QW-2)

No `export const metadata` anywhere in the app tree. Next 16 uses this for
static `<head>` injection; omitting it means title, description, and OG tags
are all empty on SSR.

### N-3: --webpack flag conflicts with turbopack config block

**File:** `apps/web/package.json:6-7`

Both `"dev"` and `"build"` scripts force `--webpack`. The `next.config.ts`
has a `turbopack: { root: ... }` block. In Next 16, Turbopack is the stable
development default. If `--webpack` is deliberate (plugin incompatibility),
it should be documented. If it is stale, removing it would give faster HMR.
NEEDS-DESIGN to validate no Webpack-specific loader breaks under Turbopack.

---

## Summary

```
┌─ LOW-RISK Quick Wins (5) ────────────────────────────────────────────┐
│ QW-1  next/font/google for 3 fonts    layout.tsx:21-29               │
│ QW-2  Metadata API + title            layout.tsx + all pages         │
│ QW-3  dynamic() for ProductKpiCard    dashboard-page.tsx:17          │
│ QW-4  staleTime 60s on 2 heavy Qs    dashboard-page.tsx:39-40        │
│ QW-5  next/script for bfcache guard   head/dashboard/page.tsx:3-15   │
└──────────────────────────────────────────────────────────────────────┘

┌─ NEEDS-DESIGN (larger) ──────────────────────────────────────────────┐
│ D-1  SSR prefetch via HydrationBoundary  [BIGGEST CWV RISK / LCP]    │
│ D-2  lead-form.tsx monolith — split 4 queries to sibling components  │
│ D-3  Font variant/axis subsetting (Fraunces display=optional)        │
│ D-4  /reports page — RSC + narrow client wrapper                     │
└──────────────────────────────────────────────────────────────────────┘

┌─ Next 16 Deprecations ───────────────────────────────────────────────┐
│ N-1  use(params) Suspense placement — OK now, forward note           │
│ N-2  metadata API absent on all routes (same root cause as QW-2)     │
│ N-3  --webpack flag vs turbopack{} config — verify or document       │
└──────────────────────────────────────────────────────────────────────┘
```

**Biggest single CWV risk:** D-1. The absence of any SSR data prefetching means
every route incurs 3-4 serial client round-trips before above-the-fold content
renders. The dehydrate config in query-client.ts is wired correctly; adding a
HydrationBoundary in the RSC page shells would activate it with minimal code.

Frozen areas respected: AI/RAG, dark theme, i18n, Telegram, Director — no
findings touch those surfaces.
