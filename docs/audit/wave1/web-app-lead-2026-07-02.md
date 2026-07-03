# Per-file audit — apps/web/src/app/(app)/lead (2026-07-02)

Read-only audit, wave 2 web (`apps/web/src/app/(app)/lead`).
5 files reviewed.
8 findings kept, 1 killed by verification.

## history/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                           | Suggestion                                                                                                                                                                                                                                                  | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 3-12  | comments  | low      | 9-line JSDoc header prefixed with a ticket/phase ref ("UX-17 (Phase 35-08)") narrating a past migration decision — over the 3-line comment budget and exactly the change-log/ticket archaeology the repo's comment-hygiene policy says to delete. | Cut to a 1-3 line WHY without the ticket/phase prefix, e.g. "Legacy route; lead history now lives at /reports (role-defaulted, no tab state)." If the migration rationale is worth keeping long-form, relocate it to an openspec spec, not the file header. |              |

Already good: Minimal single-purpose redirect shim, correctly server-only with no unnecessary client boundary.

## layout.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                           | Suggestion                                                                                                                             | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 6-12  | comments  | low      | 7-line JSDoc with a ticket/phase prefix ("AUTH-07 (Phase 29-03)") — exceeds the 3-line budget and includes archaeology git history already holds. | Trim to the load-bearing WHY only, e.g. "head/admin keep access here for impersonation/troubleshooting." Drop the ticket/phase prefix. |              |

Already good: Clean single-purpose SSR gate: one typed REQUIRED roles array, no logic beyond composing RoleGate — a good small-file example.

## report/[reportId]/page.tsx (3 findings)

| Lines | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                            | Suggestion                                                                                                                                                                                                                                            | Your verdict |
| ----- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 12-22 | comments   | low      | 11-line JSDoc with ticket/phase prefix ("Phase 35-07 (UX-15)") — over budget; narrates history instead of stating a terse non-obvious WHY.                                                                                                                                         | Shrink to 2-3 lines on the addressed-URL rationale and the readOnly server contract; drop the phase/ticket prefix.                                                                                                                                    |              |
| 31-38 | simplicity | low      | `normalizedMode` is redeclared as the literal "edit" purely to feed the redirect, even though it is always equal to the already-computed `resolvedMode` in this branch (resolvedMode falls back to "edit" whenever mode is invalid, which is the only way this branch is entered). | Drop the extra const and redirect using `resolvedMode` directly: `redirect(\`/lead/report/${encodeURIComponent(reportId)}?mode=${encodeURIComponent(resolvedMode)}\`)`.                                                                               |              |
| 47    | constants  | low      | `style={{ paddingBottom: "88px" }}` is an inline magic number duplicated verbatim in apps/web/src/app/(app)/lead/report/page.tsx:33 (both reserve space for the same lead-form fixed footer/action bar) with no named constant or shared explanation of what 88px accounts for.    | Extract a documented constant (e.g. `LEAD_FORM_FOOTER_CLEARANCE_PX = 88` in a shared lead constants module) and reuse it in both page files, or move the clearance into the LeadForm component's own layout so callers don't need to know the number. |              |

Already good: mode query-param validation/redirect keeps the URL canonical (invalid mode values normalize to /?mode=edit) rather than silently accepting garbage input.

## report/[reportId]/preview/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                       | Suggestion                                                                                                                                                                                                                                                                                                                                        | Your verdict |
| ----- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 13-28 | comments  | medium   | 15-line JSDoc block far exceeds the 3-line budget: mixes a ticket/phase prefix ("UFB-NEW-A34 (Phase 60 early activation)"), an inline citation of a past unrelated finding ("driver-findings-2026-06-11 finding 2"), and narration of what the code already expresses (RoleGate call, Suspense boundary). This is the exact NOISE pattern the comment-hygiene policy targets. | Keep only the non-obvious WHY within 3 lines — e.g. why the product list is scoped by reporting group rather than personal authorship, and why a per-page RoleGate wraps the already-gated /lead/\* layout. Strip the ticket/phase/finding-ID references; if the scoping rationale needs more context, relocate it to the relevant openspec spec. |              |

Already good: Reuses the shared AgentReviewComingSoon primitive (compact variant) rather than re-styling a bespoke coming-soon badge, and reuses RoleGate/ForbiddenPage for the per-page denial wall instead of inventing a new one.

## report/page.tsx (2 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Suggestion                                                                                                                                                                                                                                                                                | Your verdict |
| ----- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 10-21 | comments    | medium   | 12-line JSDoc header narrating history ("Phase 35-07 introduces...", "UX-15") and change-log archaeology, far over the 3-line WHY budget. The rationale is already captured in openspec/changes/archive/2026-05-25-add-report-url-id (verified: its tasks.md documents the bare-route redirectToCanonical redirect), so this is duplicated, stale-prone narration rather than load-bearing context only this file can express.                                                                                                                                                                                                                                            | Cut to a single line stating the current behavior contract (e.g. "Legacy bare route; LeadForm redirects to the addressed /lead/report/[reportId] URL once the active reportId is known."). Drop phase/ticket references — git history and the archived openspec change already hold that. |              |
| 26-39 | duplication | medium   | The `<main id="main-content" className="min-h-screen ..."><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">` wrapper is copy-pasted verbatim (swapping only the main background class) across 9 route page files (verified by grep): lead/report/page.tsx, lead/report/[reportId]/page.tsx, lead/report/[reportId]/preview/page.tsx, head/report/page.tsx, head/report/[reportId]/page.tsx, reports/page.tsx, reports/latest/page.tsx, admin/page.tsx, head/dashboard/page.tsx. The `paddingBottom: "88px"` bottom-clearance magic number is additionally duplicated inline (unnamed) in 2 of them: lead/report/page.tsx and lead/report/[reportId]/page.tsx. | Extract a shared `<ReportPageShell>` (or similar) layout primitive in components/ that owns the container classes and a named bottom-toolbar-clearance constant, and have each route page render children into it — one place to fix the offset or spacing contract instead of nine.      |              |

Already good: Small, single-purpose route file (41 lines) that does one thing: resolve `mode` and hand off to LeadForm inside a Suspense boundary — no logic creep into the page component.

## Rollup

**By dimension**

- comments: 5 (3 low: history/page.tsx, layout.tsx, report/[reportId]/page.tsx; 2 medium: preview/page.tsx, report/page.tsx)
- simplicity: 1 (low, report/[reportId]/page.tsx)
- constants: 1 (low, report/[reportId]/page.tsx)
- duplication: 1 (medium, report/page.tsx)

Total = 8 findings.

**By severity**

- medium: 3 (preview/page.tsx comments, report/page.tsx comments, report/page.tsx duplication)
- low: 5 (history/page.tsx, layout.tsx, report/[reportId]/page.tsx ×3)

**Top 3**

1. `report/page.tsx:26-39` — 9-way duplicated page-shell wrapper + unnamed 88px clearance magic number, spanning lead/head/reports/admin routes.
2. `preview/page.tsx:13-28` — 15-line JSDoc noise mixing ticket refs and an unrelated past-finding citation.
3. `report/page.tsx:10-21` — 12-line JSDoc duplicating rationale already archived in an openspec change.

**Overlap with PENDING openspec changes**
None of the 8 kept findings overlap a change in the pending list (unified-activity-entry, fix-manual-publish-archive-race, head-surface-parity-declutter, responsive-compact-layout, project-activity-reporting, review-acknowledgement, input-and-error-hardening, code-health-and-test-cleanup, fix-dashboard-nan-pending, key-charts-by-id, fix-analytics-date-matching, harden-web-vitals-endpoint, fix-prod-web-build-args, fix-open-redirect-next-param, tighten-code-quality-ratchet, tighten-comment-policy, map-domain-errors, escape-org-data-script). All are plain style/duplication/comment-hygiene cleanups local to this folder, safe for a standalone sweep.

## Killed by verification

- **preview/page.tsx:43 one-off inline gradient literal** — Wrong file: the gradient is not in preview/page.tsx (its main uses plain `bg-[var(--color-background)]` at line 36; line 43 is header markup). The literal actually lives in `apps/web/src/app/(app)/lead/report/[reportId]/page.tsx:43`, so the finding misread the code it cites. Additionally, one-off inline rgba arbitrary values are a pervasive accepted idiom across this codebase (nav-bar, login page, period-navigator, admin page shadows all embed rgba(0,98,65,…) inline), so a single-use gradient does not clear the constants bar as a confirmable violation.
