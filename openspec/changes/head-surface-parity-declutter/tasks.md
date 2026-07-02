## 0. Verify-first

- [x] 0.1 On a fresh (non-docker, from-source) build the duplicate slides header / Edit↔Slides reflow (`mqqe419t`/`mqqe3llq`) does NOT reproduce — toolbar holds top=139/left=176 across a client-side Slides→Edit→Slides round-trip, exactly one "Status Report" heading, one Context-controls + one Document-actions group. Closed as shipped (was a stale-docker-build artifact).

## 1. Slides

- [x] 1.1 Verified shipped: no standalone "Group Status Slides" header band; toolbar controls sit at the top (lead parity).
- [x] 1.2 `ReadinessStrip` already cut (readiness reads from carousel thumbnails). Agent-review placement: Саша chose to KEEP it leading the toolbar context-controls group (not the period-nav row) — the specced/tested state; no code change. Carousel placement unchanged.

## 2. Dashboard

- [x] 2.1 Verified shipped (`09a3baa4`): `ProductKpiCard` renders as a compact single-row strip (Submissions / Deadline / Risks & Blockers), not deleted.
- [x] 2.2 Fixed `LeadSummaryTable` horizontal scroll: the six fixed `4.5rem` count columns need ~970px, so the multi-column grid engaged at `md` (768px) overflowed the page by 189px in the 768–1023px band. Raised the grid-activation breakpoint `md`→`lg`; below `lg` the rows stack as per-lead cards. Verified page-overflow 0 at 375/768/900/1023/1024/1440.
- [x] 2.3 `Activity24hCard` already trimmed (no duplicate activity card on the dashboard). `BlockedAtRiskTable` verified against the roll-up: section "8 issues" = 1 `blocked` + 7 `unresolved_risk` deduped rows; KPI "1 blocked · 8 at risk" derives the same escalation set (`atRiskCount` = `at_risk` + `unresolved_risk`). Consistent — not redesigned.

## 3. Report toolbar

- [x] 3.1 Verified shipped: "Present" button removed (slides view-mode supersedes it); document actions (Export-PDF, Publish) split from the context controls; Agent-review leads the context-controls group.
- [x] 3.2 `ScopeToggle` unchanged (shared `SegmentedToggle`).

## 4. Spec follow-ups

- [x] 4.1 No cross-capability MODIFIED deltas needed: every existing-spec touch is either shipped+specced (moot) or the declined Agent-review reversal. Re-scoped this change's `head-surface-parity` ADDED spec from "introduce the demo asks" to "lock the verified/shipped contract" — including the concrete `LeadSummaryTable` `lg`-breakpoint no-scroll requirement (tablet-band + desktop scenarios) and Саша's Agent-review decision.

## 5. Verification

- [x] 5.1 `@customreport/web` typecheck clean; `eslint --max-warnings 0` clean on the changed component (repo-wide gate skipped — the working tree carries a parallel session's uncommitted `apps/api/**` edits that would pollute it; the change under review is web-only and isolated).
- [x] 5.2 74 head dashboard/slides/toolbar component tests green (lead-summary-table, dashboard-page, kpi-cards, blocked-at-risk-table, status-slide-deck, head-report-shell).
- [x] 5.3 `openspec validate "head-surface-parity-declutter" --strict` → valid.
