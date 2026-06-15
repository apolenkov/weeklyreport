# Design — Fix Report Surface Integrity

Companion to `proposal.md`. The 7-round adversarial Codex review is in `PLAN-REVIEW-LOG.md`
(this dir); this file records the load-bearing data-flow and invariant decisions OpenSpec
wants captured.

## Load-bearing invariants — preserved / mutated / relaxed

- **`lead-pipeline-card` — MUTATED (deliberate reversal).** Old: "completeness counts only
  explicitly-set stages; the risk floor is display-only and MUST NOT inflate the counter." New:
  a stage covered by the lead's OWN risk counts as addressed. The requirement and its
  reload-stability test are rewritten, not deleted.
- **`status-risk-unification` — PRESERVED + enforced.** The floor stays the single source of
  at-risk/blocked; W6 makes the read-model mapper apply it so head review + PDF match the live
  form (today they diverge — a violation we fix). W11 adds the risk-dialog "no all-stages
  default" rule.
- **`period-dual-state` — UNTOUCHED.** W3 markers are READ-ONLY (read `ReportSection.submittedAt`
  - the period's archived/state); no Report-period write path is added, so the dual-state writer
    rules and the raw-lifecycle-write CI gate are not engaged.
- **`role-coverage-gate` — MUTATED.** `pdfExport.request/status` moves to a head+admin+viewer
  chain; lead EXCLUDED (FORBIDDEN).
- **`deferred-feature-pattern` — applied + amended.** Lead Export-PDF is a UI-deferred ComingSoon
  control (never wired to a backend call); the AgentReviewComingSoon-on-`/present` requirement is
  dropped when `/present` redirects away.
- **`report-toolbar-parity` — relaxed.** Permits exactly one labeled primary Export-PDF in the
  toolbar trailing group; drops Present + browser-Print as labeled actions.

## Data flow — before / after

### Completeness (W6 + W11)

- Before: `computeCompleteness(product)` counts raw `status !== "empty"`; mapper guards
  `empty→empty`; live form floors empty-covered stages (display only) → counter excludes them.
- After: the mapper annotates each raw stage with `coveredByOwnRisk` (derived from the lead's own
  non-empty staged risks; stage-less legacy risk → false). `computeCompleteness` counts
  `status !== "empty" || coveredByOwnRisk`. The read-model mapper also applies the floor so
  head/PDF color matches the live form. Foreign/cross-author risks color but never count.
  Reload reads persisted risks + raw status — no transient display state.

### Export authz (W2)

- Before: `Present` + browser `Print` + `Export-PDF` on head/viewer; `pdfExport` leadHeadAdmin,
  viewer excluded (viewer used `/print`); `/print/[id]` is the PDF-worker template.
- After: one labeled `Export-PDF` (head/admin/viewer). `/present` 308→`?mode=slides`. `/print/[id]`
  stays worker-only: with worker export-auth → render; authenticated human without it → role-
  specific 308 (head/admin→`/head/report`, viewer→`/reports`, lead→own/FORBIDDEN); else login.
  Lead = ComingSoon UI + `pdfExport` FORBIDDEN.

### Escalations (W7)

- Before: `buildEscalations` + `buildEscalationsFromSnapshotSections` hardcode `stageName: null`;
  inputs omit `item.stageIds` / `risk.stageIds`; product via scoped non-archived map → "Unknown".
- After: both builders (or one shared builder) select stage arrays, resolve names (multi-stage
  display), fall back to "No stage set" for legacy stage-less rows; product resolves report-wide
  WITHIN the caller's authorized read model + snapshot — never an unscoped query.

### Period navigator (W3 + W4)

- Before: lead combobox (`PeriodNavigator`, global `PERIOD_LISTBOX_ID`) on lead+head-shell;
  native `HeadPeriodNavigator` on viewer/default; divergent label formats; head shell fabricates
  `isSubmitted: true` for all history entries.
- After: one combobox everywhere with `useId`-scoped instance IDs; one label formatter; markers
  via `showLeadSubmissionMarkers` + `leadSubmittedAt` (lead only, sourced from the current lead's
  `submittedAt` — never the fabricated `isSubmitted`).

## Rollout

No DB migration (MVP reshape not needed — markers/counter read existing columns). Spec deltas land
with the change. Live ↔ published-snapshot parity is mandatory for W6 + W7 (touch both paths or
extract a shared one). Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
(`npx prisma generate` first — the client gets wiped by pnpm ops).
