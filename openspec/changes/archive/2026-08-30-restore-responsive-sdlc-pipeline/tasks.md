## 1. Web presentation

- [x] 1.1 Restore the responsive stage pipeline: two-column grid below 48 rem, four-column grid from 48 rem through below 64 rem, and one non-wrapping arrow-connected lane at and above 64 rem with equal compact stage widths; verify canonical order, no horizontal swipe, and connector count from `visibleStages`.
- [x] 1.2 Preserve the current status glyph, accessible name, tooltip, lock/ownership cue, aligned assignee label, focus treatment, Mine/Everyone filtering, and collapsed-stage indicator; verify no API, persistence, permissions, or model file changes are present.
- [x] 1.3 Keep the `+N` collapsed-stage summary visible and operable by tap and keyboard focus in each layout, and keep every stage control at least 44 px tall through tablet widths; verify no clipping or root overflow.

## 2. Lead toolbar responsive contract

- [x] 2.1 Keep the Lead context toolbar in normal flow below 48 rem with no more than two explicit rows; make it sticky from 48 rem upward without a spacer-only row or clipped control.
- [x] 2.2 Apply 44 by 44 px minimums to period-navigation arrows below 48 rem and use one named conditional form-owned clearance source for the fixed completion rail; verify route containers add no competing offset, focus remains visible, and navigation semantics are unchanged.

## 3. Component contracts

- [x] 3.1 Replace the unconditional full-width-row assertions with responsive structure tests for canonical order, two/four-column grid classes, equal non-growing wide widths, connector count `N - 1`, `aria-hidden` connectors, shared chip/connector height, `+N` focus/tap semantics, and no-wrap/no-swipe contract.
- [x] 3.2 Add focused toolbar tests for the two-row phone flow, sticky tablet/desktop mode, 44 px phone period arrows, no clipping/spacer row, and one conditional completion-clearance source.
- [x] 3.3 Run the focused Web suites for pipeline, Mine/Everyone, StageChip, and Lead toolbar; verify every focused interaction, ownership, risk, focus, and layout test passes.

## 4. Acceptance and planning

- [x] 4.1 In one-off real Chrome against the exact source candidate, verify desktop, 1024 px landscape, 768 px portrait, and 375 px phone layouts; measure canonical order, connector/chip alignment in the wide lane, grid placement, root/card overflow, `+N` tap/focus, toolbar flow/stickiness, navigation touch targets, visible focus, and a persisted stage-status interaction with no console/network error.
- [x] 4.2 Run `pnpm format:check`, `pnpm lint:eslint`, `pnpm --filter @customreport/web typecheck`, and the repository-required affected gates; verify all commands pass on the same candidate SHA.
- [x] 4.3 Run `openspec validate restore-responsive-sdlc-pipeline --strict`, obtain fresh independent visual/code review, then sync/archive through the supported workflow and verify the durable `lead-pipeline-card`, `ui-control-density`, and `lead-toolbar-presentation` specs contain the accepted responsive contract.
