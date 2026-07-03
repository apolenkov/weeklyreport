# Per-file audit — apps/web/src/app/(app)/head (2026-07-02)

Read-only audit, wave 2 web.
8 files reviewed.
8 findings kept, 0 killed.

## layout.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                | Suggestion                                                                                                                                                                                                                                             | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 6-12  | comments  | low      | 7-line JSDoc header carries ticket/phase archaeology ("AUTH-07 (Phase 29-03)", "D-AUTH-03") over the 3-line comment budget. The load-bearing part (why admin is included alongside head) is real WHY worth keeping, but it's buried under ticket refs. | Strip the ticket/phase prefixes per the comment-hygiene rule; keep only the one non-obvious sentence ("admin included because adminProcedure === headProcedure") within 3 lines, or relocate the fuller rationale to the auth spec in openspec/specs/. |              |

Already good: clean, small SSR role gate consistent in shape with the sibling admin/lead/reports layouts — no bespoke reimplementation.

## report/[reportId]/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                     | Suggestion                                                                | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| 11-15 | comments  | low      | 5-line comment is pure phase/ticket archaeology ("Phase 35-07 (UX-15)", "Phase 61 (robust-baking-aurora)") narrating history rather than explaining a non-obvious WHY; the query-param → mode logic on line 22 is already self-explanatory. | Delete the comment block; git history already holds the phase provenance. |              |

Already good: correctly async server component with typed Promise-based params/searchParams (Next 16 idiom), Suspense boundary with a real skeleton fallback, and derives `mode` during render instead of via useEffect.

## history/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                      | Suggestion                                                                                                                                                                                                                                                     | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 3-11  | comments  | low      | 9-line comment mixes real rationale (why this route now redirects to /reports) with ticket archaeology ("Phase 35-08 / UX-17"), exceeding the 3-line budget. | Per the RELOCATE rule for over-budget load-bearing rationale: keep a 1-2 line WHY inline ("/head/history collapses into the shared /reports surface") and move the UAT-decision provenance to the relevant openspec spec; drop the phase/ticket refs entirely. |              |

Already good: minimal redirect component, easy to scan, no state or branching.

## dashboard/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                                                   | Suggestion                                                                                                                                                                                                   | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 13    | constants | low      | The bfcache-recovery script hardcodes the marker attribute string `data-dashboard-loading='true'` which must stay in sync with the identical literal in apps/web/src/components/dashboard/dashboard-page.tsx:202. Nothing enforces the pairing; renaming one side silently breaks the recovery reload with no type error. | Extract a single named constant (e.g. `DASHBOARD_LOADING_MARKER`) shared between the two files (or generate the selector string from it) so the coupling is explicit and renames are caught at compile time. |              |

Already good: single-purpose page wiring the bfcache-recovery script and delegating all real rendering to DashboardPage; well under size/complexity thresholds.

## report/[reportId]/present/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                              | Suggestion                                                                                                                                                                                                                                                                                                                | Your verdict |
| ----- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 7-14  | comments  | medium   | 8-line JSDoc block (comment-body ~6 lines) blows the 3-line WHY budget, and embeds ticket/phase archaeology ("fix-report-surface-integrity W2 (task 3.3)") that the repo's own comment-hygiene rule says to delete — git history already holds that. | Trim to a single load-bearing WHY line, e.g. "Legacy /present deep links must keep resolving; redirect to inline slides mode (308 via permanentRedirect, since Next 16's redirect() defaults to 307)." Move the migration narrative (route removal, task numbering) to the openspec spec/design doc, not the source file. |              |

Already good: correctly distinguishes Next 16's redirect() (307) from permanentRedirect() (308) to preserve the deep-link contract — a genuinely non-obvious framework detail worth documenting.

## report/page.tsx (2 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                               | Suggestion                                                                                                                                                                                                                                                           | Your verdict |
| ----- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 10-18 | comments    | medium   | 9-line JSDoc (7-line body) exceeds the 3-line WHY budget and narrates phase history ("Phase 35-07 introduces the addressed view ... UX-15") — exactly the ticket/phase archaeology the comment-hygiene policy says to strip.                                                                          | Reduce to the essential non-obvious WHY (bare route stays live for legacy bookmarks/links and client-redirects to the canonical addressed URL). Relocate the phase/UX-ID narrative and the note about the deprecated `?period=` query to the relevant openspec spec. |              |
| 23-32 | duplication | low      | The `<main id="main-content" className="min-h-screen bg-[var(--color-background)]">` + `<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">` wrapper is a verbatim mega-literal duplicated across ~9 route pages (admin, head/dashboard, head/report/[reportId], lead/report/_, reports/_). | Not specific to this file's own logic, but worth extracting a shared `PageShell`/`PageContainer` primitive once — the class-string tokens would then live in one place instead of being copy-pasted verbatim in every top-level route page.                          |              |

Already good: async server component stays a thin wrapper — Suspense/skeleton and redirect-to-canonical logic are correctly delegated to WeeklyReportPage rather than reimplemented here.

## slides/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                   | Suggestion                                                                                                                                                                                         | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 3-10  | comments  | low      | 6-line comment body over the 3-line WHY budget, restating design rationale (why it collapses into /reports, why it matches /head/history and /lead/history) that belongs in a spec, not inline narration. | Trim to one line: "/head/slides is a legacy alias; redirects to the shared /reports history view." Keep the Next 16 307-vs-308 note only if it's load-bearing for a caller; otherwise drop it too. |              |

Already good: clean single-purpose redirect shim, no dead logic, consistent with sibling /head/history and /lead/history aliasing.

## report/layout.tsx — clean

Already good: minimal, single-purpose gate; REQUIRED role list is a tiny named const, no boolean-flag sprawl, well under every size threshold.

## Rollup

By dimension:

- comments: 6 findings — low ×4 (layout.tsx, report/[reportId]/page.tsx, history/page.tsx, slides/page.tsx), medium ×2 (present/page.tsx, report/page.tsx JSDoc)
- constants: 1 finding — low (dashboard/page.tsx)
- duplication: 1 finding — low (report/page.tsx wrapper markup)

By severity:

- medium: 2
- low: 7

Top 3:

1. report/[reportId]/present/page.tsx:7-14 — over-budget JSDoc with ticket archaeology on a load-bearing redirect note (medium).
2. report/page.tsx:10-18 — over-budget JSDoc narrating phase history instead of the WHY (medium).
3. dashboard/page.tsx:13 — unenforced hardcoded marker string shared with dashboard-page.tsx, silent breakage risk on rename (low but structural).

Findings overlapping a PENDING openspec change: none.
All 8 findings are comment-hygiene or minor duplication/constants issues local to this folder; none touch the domains of the 18 pending changes listed (activity feed, publish/archive race, surface-parity declutter, responsive layout, project-activity reporting, review-acknowledgement, input/error hardening, code-health cleanup, dashboard NaN, chart keys, analytics date matching, web-vitals endpoint, prod build args, open-redirect, quality ratchet, comment policy, domain-error mapping, org-data script escaping). Handle all 8 in a plain style/comment-hygiene sweep.

## Killed by verification

None — 0 findings killed. All 8 raised findings held up under verification.
