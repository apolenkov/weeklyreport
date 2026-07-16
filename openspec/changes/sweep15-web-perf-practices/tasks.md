## 1. Demand-driven admin queries

- [x] 1.1 Encode and test the `activeTab` dependency table for snapshot and settings consumers, including every admin tab.
- [x] 1.2 Add `enabled` gating to `AdminPanel` snapshot/settings query options and scope error effects/loading UI to enabled queries.
- [x] 1.3 Remove the reminders timezone fallback path; make reminders wait for or report failure of the settings input it requires.

## 2. Progressive dashboard readiness

- [x] 2.1 Split dashboard mapping into weekly-backed and review-backed selectors with tests proving which panels require each source.
- [x] 2.2 Render dashboard header/static shell immediately and replace the dual-query page barrier with stable panel-sized loading slots.
- [x] 2.3 Give weekly-backed queue/review panels and review-backed KPI/escalation panels independent ready/error/retry states while retaining self-contained Activity/Reopen query ownership.
- [x] 2.4 Refactor stall/pageshow telemetry and retry handling to identify/refetch only unsettled queries without hiding successful panels.
- [x] 2.5 Preserve the canonical `no-period` terminal state once `weeklyReport.get` resolves and add partial-ready/failure tests.

## 3. Package, chunk, and font loading

- [x] 3.1 Add `experimental.optimizePackageImports` for `lucide-react` and `recharts` in `apps/web/next.config.ts` and verify the production build accepts the option.
- [x] 3.2 Point all Trends `dynamic()` loaders at the concrete chart files while preserving `ssr: false`, named exports, and `ChartSkeleton` fallbacks.
- [x] 3.3 Configure Fraunces, Lexend, and Source Sans 3 with `next/font/google`, apply CSS variables compatible with existing font tokens, and remove Google stylesheet/preconnect tags and `TODO(VERCEL-FONT)`.
- [x] 3.4 Run visual comparisons for representative lead, head dashboard, admin, viewer, and print typography/layout states.

## 4. Truthful Suspense boundaries

- [x] 4.1 Inventory data-heavy App Router page-level Suspense boundaries and classify each by actual suspending owner (`useQuery`, dynamic/lazy chunk, or `useSearchParams`).
- [x] 4.2 Remove page-level fallbacks around non-suspending report/head/lead client-query surfaces and keep explicit client skeleton/error states.
- [x] 4.3 Retain or relocate Suspense only around actual chunk/search-param suspension and add route tests that prove the intended fallback owner.

## 5. Focused verification

- [x] 5.1 Run focused AdminPanel tab-query and dashboard partial-readiness/error/retry tests.
- [x] 5.2 Run focused Trends and route-loading tests, then `pnpm build` and inspect that direct chart chunks and self-hosted font assets are emitted.
- [x] 5.3 Verify in a source-run browser that inactive admin tabs issue no parent requests and one slow dashboard query does not block ready panels.

## 6. Repository gates

- [x] 6.1 `pnpm --filter @customreport/api db:generate`
- [x] 6.2 `pnpm typecheck`
- [x] 6.3 `pnpm lint`
- [x] 6.4 `pnpm test`

## 7. Adversarial review closure

- [x] 7.1 Keep the weekly-backed Period Summary and alerts available while review or activity enrichment remains pending.
- [x] 7.2 Keep KPI and escalation panels review-backed, and surface activity failure or stall as a local retry without hiding weekly queue rows.
- [x] 7.3 Split dashboard content and query-recovery helpers so every touched production file and function satisfies the repository size limits.
