# Phase 35: UX Polish — Context

**Gathered:** 2026-05-05 (post-hoc; plan 35-01 partial — counter only, 3 LOW mockup deltas + remaining UI plans deferred)
**Status:** Ready for planning (residual: 35-02..07 + finish 35-01 mockup deltas)
**Mode:** Post-hoc scaffold — full milestone detail in `.planning/milestones/v8.0-ROADMAP.md`

<domain>
## Phase Boundary

Close the visible UX debt: the "0/7 stages" counter regression, HIST-2 Quick Filters card, role-mapping end-to-end so head/admin viewing /lead/report uses correct gating, Recharts ResponsiveContainer warnings, Risk schema `stageName` migration, 44px touch-target floor, BullMQ DLQ admin UI surface, addressable URLs for report views.

Slurps v7.0 Phase 32 (UX-08..12) + 33-03 (DLQ admin UI). Adds UX-13 (counter regression), UX-14 (HIST-2), UX-15 (addressable URLs).

In scope: counter fix via new `admin.listStageAssignmentCounts` query, HIST-2 third sidebar card with filter chips, role mapper end-to-end, ResponsiveContainer + Risk.stageName migration with backfill, single-source 44px CSS variable, /admin?tab=jobs with retry mutation, /lead/report/[reportId] addressable routing.

Out of scope: visual regression baseline (Phase 35.5+ idea), full UI redesign (v8.1 candidate — UX-16 dark-mode B2B), real iOS Safari sign-off (manual docs PR).
</domain>

<decisions>
## Implementation Decisions

- **Counter fix scope (35-01):** counter only; 3 LOW mockup deltas (DEC-2 `--color-canvas` alias, SDLC-3 locked-stage tooltip with assignee, LF-1 period-nav calendar icon) deferred — they need visual verification that's better attended.
- **Risk.stageName migration (35-04):** backfill required; existing rows get `null` stage. UI defaults to `—` placeholder when null. tRPC layer accepts both new + legacy shape during migration grace period.
- **44px touch-target single-source (35-05):** new CSS variable `--touch-target-min` driven from packages/ui; lead-form action surfaces (Save/Cancel + ChevronLeft/Right) bind to it. Future raises happen in one place.
- **Addressable URLs (35-07):** `/lead/report` 307-redirects to current period's reportId; period nav prev/next does `router.push(newReportId)` so back/forward works; deep-link to non-current period from a fresh tab opens that period.

</decisions>

<code_context>

## Existing Code Insights

- 35-01 added `admin.listStageAssignmentCounts` tRPC procedure; products-tab fetches it once and replaces the broken `product.stages.filter(...)` (which always returned 0/7 because mock-data mapper hands every product an empty stages grid).
- 35-07 plan area includes `apps/web/src/app/(app)/lead/report/page.tsx` and `head/report/page.tsx` — currently no `[reportId]` segment. Period state lives in URL search params; plan converts to path segments.
- 35-04 affects packages/shared schemas + Prisma migration + Risk dialog component.

</code_context>

<specifics>
## Specific Ideas

- 35-02 HIST-2: filter state lifted to `lead/history` page; passed to `LeadHistoryList` for client-side filter. Three pill buttons in sidebar `lead-history-sidebar.tsx`.
- 35-03 role mapper: `ReportSectionReadModel` carries `authorRole`; UI gate replaces `currentUser.role === 'Dev Lead'` magic string with structured check.
- 35-06 DLQ admin UI: new `JobsTab` component; new `admin.jobs.*` tRPC namespace; retry mutation invalidates list query; bull-board link visible alongside.

</specifics>

<deferred>
## Deferred Ideas

- UX-11 real iOS Safari PDF sign-off — manual docs PR after a real-device round; not a plan-phase artifact.
- Visual regression baseline at 1280×800 — Phase 35.5+ candidate; needs stable rendering across runs.
- Dark-mode B2B redesign (UX-16) — v8.1 visual-redesign milestone; out of v8.0 scope.

</deferred>
