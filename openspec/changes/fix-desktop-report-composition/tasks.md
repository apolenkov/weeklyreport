## 1. Shared UI and navigation

- [x] 1.1 Add a token-driven, CSS-only desktop application background with no semantic or animated content.
- [x] 1.2 Prevent desktop primary navigation from focus-scrolling the destination main below the application header, preserving the skip-link target.
- [x] 1.3 Add focused navigation and surface-style regression coverage.
- [x] 1.4 Keep navigation and primary application pages on one wider desktop frame so dense report controls remain on one row without hiding labels.

## 2. Web composition

- [x] 2.1 Stretch the History empty state to the complete desktop summary-rail grid row without fabricating data.
- [x] 2.2 Convert Head form and slides headers to a stable desktop title/action grid while preserving compact wrapping and action order.
- [x] 2.3 Hoist Head and hosted Lead slide density state into their shells and place the compact Document/Presentation control in each trailing context-toolbar cluster; standalone Lead decks may retain their local control.
- [x] 2.4 Add exactly one inert `Slide templates` Coming-Soon control in slides mode and keep the working density control functional.
- [x] 2.5 Add focused component tests for History alignment, Head/Lead action placement, density reversibility, hosted single-control parity, and deferred-control uniqueness.
- [x] 2.6 Stabilize compact Dashboard action tracks and queue skeleton geometry, with zero horizontal action delta across Details/Less.

## 3. Planning and evidence

- [x] 3.1 Add `openspec/deferred/add-slide-template-selection` with catalog, preview, persistence, export, activation, and non-goal boundaries.
- [x] 3.2 Run focused Vitest, web typecheck, changed-file ESLint/Stylelint/Prettier, `git diff --check`, and `openspec validate fix-desktop-report-composition --strict`.
- [x] 3.3 Capture a fresh source-bound desktop matrix for Head History, Dashboard, Status form, Status slides Product/Leads, and the shared Lead controls.
- [x] 3.4 Run accessibility and interaction checks, obtain independent full-set visual review, and repeat affected captures after every source change.

Evidence: `customreport-archive/2026-08-17-desktop-showcase-8c59ef306/` binds seven `1980x1178` captures and their SHA-256 values to product commit `8c59ef306399c6bad6b6c62664bcc6ff93bc8b99` / tree `09c1a80eeb90ea1f87c4de4835956d53eba67caf`. All seven routes had `scrollY=0`, zero body overflow, zero scoped axe A/AA violations, and zero browser-console errors; Dashboard action coordinates had `0px` disclosure delta. Independent direct full-set visual review returned `APPROVE` with no blockers.

## 4. Owner-feedback correction

- [x] 4.1 Record equal Dashboard action-tier dimensions in the design system and normative interaction spec.
- [x] 4.2 Add focused regression coverage for summary-track fill and expanded action-cell sizing.
- [x] 4.3 Apply the tokenized dimensions without changing action behavior or mobile scope.
- [x] 4.4 Re-measure the live desktop DOM, capture fresh Dashboard evidence, and obtain independent visual approval.

Evidence: `customreport-archive/2026-08-17-dashboard-action-alignment/` contains fresh collapsed and expanded captures at `1280x720` and `1980x1178`. Live measurements showed `Review` / `Details` / `Less` at `88x44px`, `Open` / `Request Changes` / `Revoke` at `148x44px`, and zero summary-action coordinate delta after expansion. The page retained `scrollY=0`, zero body overflow, zero console errors, and zero axe WCAG A/AA violations. Two independent direct visual reviews returned `APPROVE` / `PASS` with no blockers.

## 5. Owner-feedback correction: History empty-state semantic surface

- [x] 5.1 Add focused History empty-state token coverage and replace only its elevated card background with `--color-surface-empty`, preserving the desktop rail alignment, centered copy, data behavior, and mobile scope.
- [x] 5.2 Capture the seeded desktop History empty state on the resulting exact source, verify computed token, rail alignment, `scrollY=0`, console/axe cleanliness, and obtain fresh independent full-frame visual approval before treating this correction as accepted.

Evidence: `customreport-archive/2026-08-17-history-empty-surface-d89b99cf/` binds the exact `1980x1178` viewport capture and computed metrics to product commit `d89b99cf768e6d8af2ff695c7322409e1333c1dc` / tree `7aa1091a2403c44721a4d0e193b5f136f8c99dc9`. The guarded minimal seed produced the real empty History state. Computed `--color-surface-empty` was `#fafaf7`; empty-panel/summary-rail top and bottom deltas were both `0px`; `scrollY`, horizontal overflow, scoped axe A/AA violations, console errors, page errors, and failed requests were all zero. Real `History -> Dashboard -> History` clicks preserved `scrollY=0` and the complete header. Two fresh independent direct visual reviews returned `APPROVE` with no blockers.

## 6. Final desktop acceptance corrections

- [x] 6.1 Verify `/reports/latest` preserves the viewport with `scroll: false` and add focused regression coverage.
- [x] 6.2 Verify the `chart-1`/`chart-4` legend tokens meet desktop WCAG AA contrast and add token regression coverage.
- [ ] 6.3 Capture a complete fresh exact-SHA 51-frame + T01-T07 canonical-seeded real-Chrome packet with manifest, checksums, and nonvisual oracles.
- [ ] 6.4 Obtain two independent full-frame reviews and complete the final acceptance synthesis.

Current evidence: `customreport-archive/2026-08-18-desktop-ui-acceptance-180ba64c/CANDIDATE-PROBE.json` and the focused 7/7 deterministic checks cover the candidate corrections. Canonical DB replay and the complete 51-frame + T01-T07 packet remain NOT-PROVEN; historical packets do not close tasks 6.3 or 6.4.

## 7. Owner-feedback correction: Head Presentation canvas and carousel

- [x] 7.1 Add focused tests first for Head carousel edge-disabled states, one-step Previous/Next selection, selected-card visibility, and the tokenized Presentation frame contract without brittle total-button counts.
- [x] 7.2 Add a focused CSS token regression using the shared `readPackageStyleSource` helper for the full-width Presentation frame and compact `360px` minimum.
- [x] 7.3 Implement the minimal Head Presentation frame and carousel correction: full available width, tokenized auto-growing minimum with skeleton parity, explicit edge-aware arrows, smooth/snap scrolling, and selected-card visibility; preserve density, ordering, fullscreen, and mobile behavior.
- [x] 7.4 Run focused Vitest, web typecheck, targeted ESLint/Stylelint/Prettier, `git diff --check`, and strict OpenSpec validation.

Evidence: the focused Head carousel/token/skeleton checks and static gates pass on the current worktree. Fresh exact-SHA real-Chrome capture and independent review remain governed by tasks 6.3 and 6.4; this no-runtime tranche does not close them.
