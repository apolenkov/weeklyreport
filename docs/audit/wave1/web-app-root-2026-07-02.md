# Per-file audit — apps/web/src/app (2026-07-02)

Read-only audit, wave 2 web.
11 files covered.
20 findings kept, 1 killed by verification.

## login-page.client.tsx (4 findings)

| Lines                                            | Dimension       | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                         | Suggestion                                                                                                                                                                                                 | Your verdict |
| ------------------------------------------------ | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-403                                            | size-complexity | high     | File is 403 lines, past the 250-line cap. `LoginPageBody` (~137-403, ~260 lines) owns session-query, org-query, redirect side effects, last-role localStorage hydration, SSO href derivation, and three JSX regions — 5+ concerns in one component, far past the 50-line function limit.                                                                                        | Split into a hook (`useLoginSession`/`useLastRoleHint`) plus presentational subcomponents (`LoginHero`, `PrimaryCtaButton`, `RolePickerCard`) under a `login/` folder, composed by a thin `LoginPageBody`. |              |
| 23-46, 56-62, 148-164, 195-202, 275-282, 343-351 | comments        | high     | Repeated large comment blocks (7-24 lines each) blow the 3-line WHY budget and are full of ticket/phase archaeology forbidden by policy: "UX-16 (Phase 35-08)", "UFB-071 (2026-05-11)", "UFB-047 / Phase 48-A", `TODO(Phase-59-multi-org)` pointing at `.planning/phases/`, "UFB-033", "UFB-060", "UFB-071 (rev 2026-06-10)". Change-log narration, not current-code rationale. | Delete ticket/phase/date prefixes; keep only the non-obvious WHY in <=3 lines per site. Relocate genuinely load-bearing rationale (role-routing table, multi-org TODO) into an openspec spec/design doc.   |              |
| 222, 237, 391                                    | constants       | medium   | Raw hex literals `#ece8e2` (3x) and `#fafaf7` (line 222) bypass the design-token system used elsewhere in this file. Verified: a token for `#fafaf7` already exists (`--color-surface-empty`, packages/ui/src/styles/globals.css:32) so line 222 skips an existing token; `#ece8e2` has no token anywhere in the repo.                                                          | Use `var(--color-surface-empty)` for `#fafaf7`; promote `#ece8e2` to a new CSS custom property (e.g. `--color-border-subtle`) and reference via `var(...)`.                                                |              |
| 290-297                                          | duplication     | medium   | Stub-mode fallback href is hand-built as a literal string (line 295), duplicating exactly what `devLoginHref(role, email)` (line 81) + `DEV_EMAIL_FOR_ROLE.admin` already compute.                                                                                                                                                                                              | Replace with `devLoginHref("admin", DEV_EMAIL_FOR_ROLE.admin)`.                                                                                                                                            |              |

Already good: type guards `isOrganizationPublic`/`isRole`/`getSessionRole` are small, pure, single-purpose, and correctly narrow unknown query data instead of unsafe casts.

## page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                     | Suggestion                                                                                                           | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| 4-11  | comments  | medium   | 8-line JSDoc header with a ticket reference ("UFB-070") on an app-internal default export, well over the 3-line WHY budget. | Shrink to one line explaining why the org fetch happens server-side (avoids hydration mismatch); drop the ticket ID. |              |

Already good: clean RSC/client split — this file does exactly one thing (server-fetch org, hand off as a prop) and defers all interactivity to `LoginPageClient`.

## layout.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                | Suggestion                                                                                                  | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------ |
| 33-38 | comments  | low      | 6-line TODO about migrating Google Fonts to `next/font/google` exceeds the 3-line budget, though it is genuine deferred-work rationale, not narration. | Trim to 2-3 lines (what's deferred + why), or move detail to an openspec change/spec with a 1-line pointer. |              |

Already good: `generateMetadata` fetches org server-side so title is correct on first paint — good use of the Metadata API instead of a client effect; `RootLayout` stays a small, single-purpose composition of providers.

## error.tsx (1 finding)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                      | Suggestion                                                                                                                                                  | Your verdict |
| ----- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 17-24 | duplication | medium   | This route-level error boundary renders completely unstyled markup (bare div/h2/button, no `role="alert"`, no shared card surface), while the sibling `QueryErrorBoundary` (apps/web/src/components/error-boundary.tsx:29-37) already has a styled, accessible alert fallback. Two divergent error surfaces in the same app. | Extract `QueryErrorBoundary`'s fallback JSX into a shared `ErrorFallback` component and reuse it here (with `role="alert"`) instead of a bare unstyled div. |              |

Already good: minimal, single-purpose, correctly reports to Sentry via a `useEffect` keyed on the error prop (legitimate side effect, not derivable state).

## api/client-logs/route.ts (1 finding)

| Lines | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                | Suggestion                                                                                                                                               | Your verdict |
| ----- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 3     | env-config | medium   | `const API_URL = process.env.API_URL ?? "http://localhost:3002";` is a silent fallback for product config; the same literal fallback is duplicated across `api-readiness-placeholder.tsx`, `get-org-public.ts`, `get-server-session.ts`, `get-print-route-context.ts`. | Read `API_URL` via a required env accessor (fail loud when unset) instead of `??` defaulting; centralize it in one place (e.g. `lib/server/api-url.ts`). |              |

Already good: tight, single-purpose proxy handler; swallows fetch failure into a harmless 204 rather than crashing the client-log pipeline.

## api/revalidate-org/route.ts — clean

Already good: auth + CSRF checks are concise, each with a one-line non-obvious WHY comment (server-to-server bypass reasoning), staying within the 3-line comment budget.

## global-error.tsx (1 finding)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                   | Suggestion                                                                                                                                                                                                                           | Your verdict |
| ----- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 1-27  | duplication | low      | Near-identical to `error.tsx`: same `Sentry.captureException(error)` effect, same "Something went wrong" + reset-button markup. Only the outer html/body wrapper differs (required by the Next.js root-error convention). | Extract the shared bit (Sentry capture effect + fallback message/button) into `components/error-fallback.tsx`; have both `error.tsx` and `global-error.tsx` render it, `global-error.tsx` still supplying its own `<html>`/`<body>`. |              |

Already good: correctly scoped to only the required Next.js root-error contract (html/body + reset), no scope creep.

## auth/error/page.tsx (2 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                    | Suggestion                                                                                                                                                        | Your verdict |
| ----- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 8-12  | constants   | low      | The `reason` query values (`invalid_assertion`, `session_expired`, `unauthorized`) form a cross-file contract with `apps/api/src/modules/auth/auth.routes.ts`, which emits `invalid_assertion` as a raw string literal (lines 58, 61, 167). No shared type/enum; verified `session_expired`/`unauthorized` currently have no emitter anywhere in the repo. | Move the reason keys into `packages/shared` (e.g. an `authErrorReasons` const/enum); have both the API redirect builder and this page's message map reference it. |              |
| 22-41 | duplication | low      | The destructive-icon circle + heading + CTA button pattern is hand-rolled with inline styles (`style={{ minHeight: "44px" }}`, also duplicated in `admin/page.tsx:64`) instead of the existing packages/ui button primitive; the pill+starbucks-accent re-styling recurs across ~10 files.                                                                 | Reuse the shared `Button` primitive (or extract a pill-CTA variant) instead of re-styling inline; drop the inline `minHeight` in favor of a Tailwind class.       |              |

Already good: good a11y touches — `aria-hidden` on the decorative icon, explicit `aria-label` on the return-to-login anchor, `id="main-content"` landmark.

## print/[reportId]/page.tsx (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                      | Suggestion                                                                                                                                                                                             | Your verdict |
| ----- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 7-27  | comments  | medium   | 20-line route-header comment block (discriminator ordering rationale) is ~7x the 3-line budget. Content is genuine non-obvious WHY, not narration, so it's a RELOCATE finding, not a delete. | Trim to a 2-3 line pointer ("worker discriminator must be checked before session — see spec X"); move the full ordering rationale into an openspec spec (none currently owns this route) or design.md. |              |
| 33-44 | comments  | low      | 12-line JSDoc on `humanRedirectPath` duplicates the over-budget pattern of the file header, re-explaining the lead-FORBIDDEN design decision inline instead of pointing at a durable spec.   | Collapse to one sentence stating the lead destination; relocate the "why FORBIDDEN wasn't built" justification alongside the file-header relocation target.                                            |              |

Already good: thin, honest server gate — the `switch` in `humanRedirectPath` has no default case, so TypeScript enforces exhaustiveness over `Role`; each branch is small and single-purpose.

## print/[reportId]/print-report-template.tsx (6 findings)

| Lines   | Dimension       | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                        | Suggestion                                                                                                                                                                                                                                      | Your verdict |
| ------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-725   | size-complexity | high     | File is 725 lines, ~3x the 250-line hard cap, kept green only via a local `/* eslint-disable max-lines */`. Four render-only concerns (portfolio table, per-lead section, loading shell, top-level template) crammed into one client file.                                                                                                                                                                     | Split into sibling files: `portfolio-table.tsx` (`PortfolioTable`), `lead-section.tsx` (`LeadSection`), `loading-shell.tsx`, keeping `print-report-template.tsx` as the thin orchestrator. Drop the max-lines exemption once split.             |              |
| 479-725 | size-complexity | high     | `PrintReportTemplate` itself is ~246 lines of render body (query handling + 5 nested sections of inline-styled JSX), ~5x the 50-line function cap.                                                                                                                                                                                                                                                             | Extract each labeled section (ExecutiveSummary stat cards, PortfolioOverview section, ProductReports section, Header, Footer) into its own small component; `PrintReportTemplate` should just compose them plus the useQuery/loading branches.  |              |
| 174-456 | size-complexity | high     | `LeadSection` is ~283 lines covering header row, needs-attention banner, and four independent list blocks (Current Week/Next Week/Risks/Decisions/Priorities), ~6x the 50-line cap.                                                                                                                                                                                                                            | Split into small sub-components (`LeadHeader`, `NeedsAttentionBanner`, `WeekList`, `RiskList`, `DecisionList`, `PriorityList`) so `LeadSection` becomes a short composition of them.                                                            |              |
| 39-78   | duplication     | medium   | `statusColor`/`statusLabel`/`workflowBadge` re-implement a status-enum-to-label/color switch that already exists elsewhere: `weekly-report-groupers.ts` `statusLabelFor` (mapper already writes `report.statusLabel`/`portfolio.statusLabel`), `admin/action-log-tab.tsx` `statusLabel`, `charts/period-comparison.chart.tsx` `statusColor`/`statusLabel`, and the token color map in `product-accordion.tsx`. | Prefer the mapper-provided `report.statusLabel`/`portfolio.statusLabel` where the shape matches; factor one shared status-presentation helper (lib/mappers or packages/shared) that all call sites import instead of five independent switches. |              |
| 458-475 | duplication     | low      | `LoadingShell`'s `<main>` style object duplicates the main template's `<main>` style object (546-558) almost verbatim (missing only lineHeight/letterSpacing).                                                                                                                                                                                                                                                 | Factor a shared `PRINT_PAGE_STYLE` base object and spread the two extra properties on top for the loaded state.                                                                                                                                 |              |

Already good: correctly routes load-failure through `formatClientErrorMessage` instead of surfacing raw Zod issues, and explicitly guards the no-period sentinel case even though it "shouldn't occur" — defensive without being silent.

## (app)/layout.tsx (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                     | Suggestion                                                                                                                                                                                                | Your verdict |
| ----- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 26-28 | comments  | low      | Comment leads with a ticket reference ("UFB-065: ..."), which the comment-hygiene policy explicitly calls out as archaeology to delete — git history already owns the ticket link.                          | Drop the "UFB-065:" prefix; keep only the load-bearing rationale (skeleton fallback eliminates the nav-bar FOUC flash on cold reload).                                                                    |              |
| 12-22 | comments  | low      | 10-line JSDoc header on a small, self-explanatory 12-line component exceeds the 3-line budget; the `useSession()`/`DEV_SESSION` explanation duplicates what `SessionProvider`'s own module should document. | Trim to 1-2 lines noting only the non-obvious part (why the null-session branch is a "safety net" given proxy.ts already gates access); move the `useSession()` API description to `session-provider.ts`. |              |

Already good: minimal, single-concern layout — Suspense-wrapped NavBar with a matched-height skeleton to avoid CLS, `SessionProvider` wraps children, nothing extraneous.

## Rollup

**By dimension**

| Dimension       | Count |
| --------------- | ----- |
| comments        | 7     |
| duplication     | 6     |
| size-complexity | 4     |
| constants       | 2     |
| env-config      | 1     |

**By severity**

| Severity | Count |
| -------- | ----- |
| high     | 5     |
| medium   | 7     |
| low      | 8     |

**Top 3**

1. `print-report-template.tsx` — 725-line file with a local `eslint-disable max-lines`, plus three functions (`PrintReportTemplate`, `LeadSection`, and the file overall) each ~5-6x over the 50-line/250-line caps. Single biggest structural debt in this folder.
2. `login-page.client.tsx` — 403-line file with a 260-line component mixing 5+ concerns, plus six separate ticket/phase-archaeology comment blocks that violate comment hygiene throughout.
3. Cross-file duplication of shared UI/logic idioms instead of reuse: status-color/label switches re-implemented 5x (`print-report-template.tsx` vs. mapper/`action-log-tab.tsx`/`period-comparison.chart.tsx`/`product-accordion.tsx`), and two divergent unstyled/styled error-fallback implementations (`error.tsx` vs. `QueryErrorBoundary`) plus a third near-duplicate (`global-error.tsx`).

**Findings overlapping a pending OpenSpec change** (handle there, not in a style sweep)

- All comment-hygiene findings (`login-page.client.tsx` x1, `page.tsx`, `print/[reportId]/page.tsx` x2, `(app)/layout.tsx` x2) → **tighten-comment-policy**.
- `print-report-template.tsx` size-complexity trio (1-725, 479-725, 174-456) and `login-page.client.tsx` size-complexity (1-403) → **tighten-code-quality-ratchet** / **code-health-and-test-cleanup**.
- `error.tsx` / `global-error.tsx` duplicate/unstyled error-fallback findings, and `auth/error/page.tsx` `reason` cross-file-contract finding → **input-and-error-hardening** / **map-domain-errors**.

All other findings (constants, remaining duplication, env-config) have no pending-change overlap and are fair game for a standalone style/cleanup pass.

## Killed by verification

- **print-report-template.tsx 39-50, 84-724 (constants)** — hex/rgba colors inlined as magic literals instead of named constants or `--color-status-*` design tokens. Killed: project memory `status-color-token-sweep-followup` records that during the status-color token sweep the print template's colors were explicitly **decided leave-as-is** with an instruction not to reopen. Re-raising tokenization for the print template re-litigates a settled call. The literals do exist as described — only the decision record refutes the finding.
