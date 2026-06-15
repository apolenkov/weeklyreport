# Tasks — Fix Report Surface Integrity

Locked brief: this change's `proposal.md` + `design.md` (work-streams W1–W11) + `PLAN-REVIEW-LOG.md`
(Codex APPROVED, round 7) + `HANDOFF.md`. Read first. Implement in a fresh session via Workflow. Order: shared/ui → api → web →
tests → planning+docs. Each box ≈ one commit. Behavior over speed; live ↔ snapshot parity is
mandatory where noted. UI strings stay English.

## 0. Design — RESOLVED, see `design.md` + `PLAN.md`

- [ ] 0.1 Re-read `proposal.md`/`design.md`/`HANDOFF.md`; confirm the export matrix, `/present`+`/print` route
      behavior, completeness reversal (W11), and live↔snapshot parity scope before coding.

## 1. shared / ui

- [ ] 1.1 ui: a 32×32 inert ComingSoon icon export control for the lead toolbar (mirror
      `VersionComingSoonControl`); `TODO(lead-pdf-export)` at the activation point. (W2)
- [ ] 1.2 shared/types: add a `coveredByOwnRisk` annotation to the raw-stage shape consumed by
      `computeCompleteness` (or the mapper output type). (W11)

## 2. api

- [ ] 2.1 `role-coverage-gate`: move `pdfExport.request/status` to a head+admin+viewer chain;
      lead EXCLUDED (FORBIDDEN). Update role-coverage tests. (W2)
- [x] 2.2 Escalations: select `item.stageIds` + `risk.stageIds`; resolve stage name(s),
      multi-stage display; "No stage set" for legacy stage-less rows. Fix BOTH
      `buildEscalations` and `buildEscalationsFromSnapshotSections` (or extract one shared
      builder). (W7)
- [x] 2.3 Escalation product name resolves report-wide WITHIN the caller's authorized read
      model + snapshot — never an unscoped project query. (W8)
- [ ] 2.4 KPI: relabel/re-base "ACTIVE LEADS" so the card matches what it counts. Leave the
      `status` vs `periodStatus` telemetry keying ALONE unless a failing test proves divergence
      (discovery task only). (W9)

## 3. web

- [ ] 3.1 Head report header → lean lead shape: status pill left; toggles + actions right;
      single `ReportToolbar` period row; publish hint on the status row. (W1)
- [ ] 3.2 Presentation/export: one labeled Export-PDF in the toolbar trailing group; remove the
      Present + browser-Print header links; lead shows the ComingSoon control from 1.1. (W2)
- [ ] 3.3 Routing: `/present` → 308 `?mode=slides` (head + viewer); `/print/[id]` worker-only
      with the role-specific human-redirect discriminator; update nav active-matching,
      route-match helpers, report-shell + head-shell placeholder tests, sweep fixtures. (W2)
- [x] 3.4 Period navigator: unify on the combobox everywhere; `useId`-scoped listbox IDs; drop
      `HeadPeriodNavigator`; one navigator label formatter (the combobox `periodLabel`). Per
      design.md the "one label formatter" is navigator-scoped — deleting the native navigator
      collapses the two navigator formats into one; slides/print/history/dashboard/FillFrom use
      different display contexts (locked by their own tests) and are out of W4 scope. (W4)
- [x] 3.5 Navigator markers: current / archived everywhere; per-lead "submitted" via
      `showLeadSubmissionMarkers` + `leadSubmittedAt` (lead only; source = current lead's
      `submittedAt`, NOT the fabricated `isSubmitted`). (W3)
- [ ] 3.6 ScopeToggle restyle into the shared segmented-toggle family. (W5)
- [ ] 3.7 Floor display consistency: read-model mapper (`lead-form.ts`) applies the same floor
      as the live form; fix stale `empty→empty` comments. (W6)
- [ ] 3.8 Completeness (W11): mapper annotates raw stages with `coveredByOwnRisk` (own non-empty
      staged risks; stage-less legacy → false); `computeCompleteness` counts
      `status !== "empty" || coveredByOwnRisk`; foreign risks never count.
- [ ] 3.9 Chip distinction (W11): "covered by risk" vs "status set" — visual AND aria-label/
      tooltip ("Blocked by risk" vs "Blocked — status set").
- [ ] 3.10 Risk dialog (W11): stage multi-select defaults to the clicked stage only; product
      switch (`setProductAndStages`) clears/limits selection — NEVER all owned stages by default.

## 4. tests + gates

- [ ] 4.1 W11/W6 combined reload regression: a raw-null OWN stage covered by an OWN risk renders
      floored, counts in X/7, stays distinguishable from an explicit status after reload.
- [ ] 4.2 W6 export regression: floored stage renders correctly through the PDF worker / print
      template (not just the mapper).
- [x] 4.3 a11y: two navigators on one page (no duplicate IDs / broken `aria-activedescendant`);
      keyboard parity with the replaced native select.
- [x] 4.4 Escalation tests: stage present (live + snapshot), multi-stage, "No stage set" legacy.
- [ ] 4.5 Gates green: `npx prisma generate` then `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build`.

## 5. planning + docs (spec deltas)

- [ ] 5.1 Author/finalize the spec deltas under `specs/` for: `lead-pipeline-card` (REVERSAL),
      `status-risk-unification`, `report-toolbar-parity`, `head-toolbar-semantics`,
      `report-routing`, `deferred-feature-pattern`, `sweep-runtime-correctness`,
      `role-coverage-gate`, `period-lifecycle-ui`, `report-badge-resolution`,
      `risk-stage-integrity`. (Drafts created with this change — verify against final code.)
- [ ] 5.2 `openspec validate fix-report-surface-integrity` passes; archive after PR merge.
