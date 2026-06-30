## 0. Verify-first

- [ ] 0.1 On a fresh build, check whether the duplicate slides header / Edit↔Slides reflow (`mqqe419t`/`mqqe3llq`) still reproduces. If not → close as shipped. If yes → add a whole-header positional-stability requirement (homed where header composition is governed, not toolbar-semantics).

## 1. Slides

- [ ] 1.1 Remove the "Group Status Slides" redundant header line; move toolbar controls to the top (lead parity).
- [ ] 1.2 Move Agent-review into the period-navigation row; clarify or cut the `ReadinessStrip`. Keep the carousel placement.

## 2. Dashboard

- [ ] 2.1 Slim `ProductKpiCard` to a compact single-row strip (Submissions / Deadline / Risks & Blockers) — do NOT delete.
- [ ] 2.2 Fix `LeadSummaryTable` styling / unexpected horizontal scroll.
- [ ] 2.3 Trim the low-value `Activity24hCard`; verify `BlockedAtRiskTable` against the escalation/`at_risk` roll-up (don't redesign).

## 3. Report toolbar

- [ ] 3.1 Place publish / request-all-reopen / Agent-review / Edit like the lead's status row (top-left of the logo); remove the "Present" button.
- [ ] 3.2 Leave `ScopeToggle` unchanged (shared `SegmentedToggle`).

## 4. Spec follow-ups (MODIFIED — exact headers)

- [ ] 4.1 Author MODIFIED deltas to `report-toolbar-parity`, `head-toolbar-semantics`, `head-slide-density`, `head-dashboard-clarity`, `toolbar-polish` as the implementation lands.

## 5. Verification

- [ ] 5.1 `pnpm typecheck` + `pnpm lint` until green.
- [ ] 5.2 `pnpm test` (head dashboard/slides/toolbar component tests) until green.
- [ ] 5.3 `openspec validate "head-surface-parity-declutter" --strict` until it exits 0.
