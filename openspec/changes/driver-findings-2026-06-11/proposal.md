# Driver Findings — All Roles (2026-06-11)

## Why

The ai-ui-driver drove the live app (`:3000`) across the **lead**, **head**,
and **viewer** roles and adversarially re-checked each finding. This change
consolidates the confirmed results into one tracked backlog so the cosmetic
fixes can land tonight and the risky ones wait for an explicit decision.

Nine raw findings (5 lead, 3 head, 1 viewer) dedupe to **7 distinct issues**:
two pairs share one root cause and surfaced under two roles each.

Scope assumption (stated explicitly): this is the **all-roles** 2026-06-11
consolidation. The 5 lead findings overlap the already-committed hand-rescue
capture `driver-findings-lead-2026-06-12` (run `wf_d2d739f7-3a7`). To avoid a
spec collision this change asserts **no** durable contract on the lead
capability `lead-report-controls-integrity` (the lead change owns it); it
records findings + pending decisions only, and cross-references that change.

Per repo memory the driver skeptic both false-confirms and false-dismisses, so
every finding MUST be re-verified in the live browser before its fix is
committed. Every code anchor below was confirmed against the current tree.

## What Changes

This capture records 7 issues grouped by route and splits them by **fix-risk**
(not severity) so the low-risk set can land tonight and the risky set waits for
sign-off. It asserts ONE durable contract — a MODIFIED + ADDED delta on the
existing `client-error-policy` capability — because finding 1 is a violation of
that capability's already-shipped "no raw `error.message` in toast copy" rule,
not a new product decision. The delta tightens the rule to cover validation
(Zod / `BAD_REQUEST`) and not-found errors and forbids retrying deterministic
4xx. All other findings stay capture-only pending decision or are owned by the
lead change.

### `/lead/report/[reportId]`, `/reports/[reportId]`, `/head/report/[reportId]` — error UX

1. **Raw Zod JSON leaks into a user toast (systemic) + deterministic 4xx
   retried 3×.** A malformed `reportId` makes `formatClientErrorMessage`
   (`lib/client-error-reporting.ts:70-86`) echo the raw tRPC Zod
   `error.message` (the serialized issues array) into a sonner toast. It fires
   on `leadForm.byPeriod` (lead) AND `weeklyReport.get` (head: also shows a
   wrong "No active reporting period" empty-state). Separately
   `lib/query-client.ts` sets no `retry` override, so a deterministic 400 is
   retried 3× (observed 207/400/400/400). Cross-role seam. **Risky** (touches
   the global error/retry policy every role flows through). Merges lead Zod-leak
   and head malformed-reportId findings.

### `/lead/report/[reportId]/preview` — scope

2. **Lead "Section Preview" renders the whole portfolio, not the lead's own
   section.** `WeeklyReportPage` receives `authorId` only for
   open/highlight/scroll and never filters products
   (`weekly-report-page.tsx:95,264-279,397,427`). Product decision (unified vs
   slice); the fix touches a shared page. **Risky — needs decision.**

### `/reports/[reportId]`, `/lead/report/[reportId]/preview` — export-PDF catalog

3. **Stale catalog intents expect an Export-PDF button leads/viewers do not
   get.** The 2026-06-09 fix gated `ExportPdfButton` behind `canMutatePeriod`
   (head/admin only); leads/viewers get a `/print` link instead. Oracle intents
   `lead-export-pdf`, `lead-export-preview-pdf`, and `viewer-export-report-pdf`
   (`e2e/catalog/viewer.yaml:53-58`) are stale. Catalog/oracle correction, not
   app code. **Risky — needs decision.** Merges lead and viewer export findings.

### `/head/report/[reportId]` — period navigator

4. **PeriodNavigator shows the wrong period (high).** The combobox lists only
   the latest _published_ period and marks it selected while the body shows the
   active week. Two root causes: `head-report-shell.tsx:58-73` builds `periods`
   from `compiledHistory` (published+archived only; active week absent;
   `isCurrent` hardcoded false), and `period-navigator.tsx:92-96` resolves
   `currentIndex` via a `/lead/report/…` regex that never matches the head path.
   Fixing the regex alone is insufficient. **Risky.**

### `/reports/[reportId]`, `/lead/report/[reportId]/preview` — counts

5. **Product accordion prints hardcoded plural "1 items".**
   `product-accordion.tsx:269` always prints `items` (Next-Week at line 313
   already pluralizes correctly). A `pluralize(value, singular, plural)` helper
   exists at `admin/reminders-tab-format.ts:70` — lift to a shared util. Shared
   component; label-only. **Low.**

### `/reports → /lead/report/[reportId]` — search anchor

6. **Search deep-link builds a dead `#section-<id>` anchor.**
   `search/search-input.tsx:66` emits `#section-<reportSectionId>` but no lead
   form element renders that `id`. Confirmed at code level; not live-reproduced
   this run. Either render the target or strip the fragment. **Low.**

### `/head/dashboard`, `/reports/trends` — chart warning

7. **Recharts `ResponsiveContainer` logs `width(-1)/height(-1)` on mount.** The
   chart still renders; transient console warning only. Give the wrapper an
   explicit `minHeight`/aspect. **Low.**

## Non-goals

- Re-asserting the lead `lead-report-controls-integrity` contract — owned by
  `driver-findings-lead-2026-06-12`; findings 5 and 6 here are cross-references.
- Any code change under risky findings (1–4) before sign-off.
- Dark-mode / theme / background work.

## Out of Scope

- admin-role driver run (not executed this pass).
