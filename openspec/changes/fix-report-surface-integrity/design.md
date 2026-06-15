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
  non-empty staged risks via `riskCoversStage`; stage-less legacy risk → false). It KEEPS the raw
  `status` (the `empty→empty` short-circuit stays). `computeCompleteness` counts
  `status !== "empty" || coveredByOwnRisk`. The flag has two producers — the mapper (reload/load)
  AND a render-time derivation in `lead-form-sync-bridge` `Pipeline()` (so the in-session counter
  ticks without reload). Foreign/cross-author risks color but never count.
  Reload reads persisted risks + raw status — no transient display state.
- **Deviation (verified in source during impl, 2026-06-15):** W6 head/PDF stage-color parity is
  ALREADY satisfied — no surface renders an empty-covered stage un-floored. The live form re-floors
  via `applyRiskSeverityFloor`; head slides re-floor via `floorSlideStageStatus`; head-form /
  preview / PDF render product `worstStatus` and have NO stage grid at all. So the mapper must
  PRESERVE raw status + add `coveredByOwnRisk` (NOT floor raw — flooring would count foreign-covered
  stages in X/7 and erase the 3.9 risk-covered-vs-status-set distinction). Task 3.7 reduces to: fix
  the stale `empty→empty` comments; the floor is left where it already lives. Task 4.2's
  stage-color-in-PDF assertion is dropped (no stage color in the print template) and replaced by a
  product-level `worstStatus` regression guard. Phase-3 Codex grill should adversarially re-check
  this deviation.

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
