## 1. Wave 1 — calibration (S-slices + defect tests)

- [x] 1.1 web-analytics, web-pdf-export, web-viewer-telemetry, web-dashboard:
      regrade live violations, fix to standard, resolve seed minors
- [x] 1.2 Defect tests verified already fixed pre-campaign (64834f55,
      4d3e4051, 2026-07-17); both pass targeted, no edits needed
- [x] 1.3 Calibration verdict: splits follow real responsibilities, verifiers
      caught one undisclosed render-token swap (accepted as ratified
      tokenization); harness approved for scale-out

## 2. Waves 2–6 — remaining S-slices

- [x] 2.1 web-shared
- [x] 2.2 web-lib
- [x] 2.3 api-lib
- [x] 2.4 api-auth-admin (load-bearing: auth; cross-vendor review — Codex pass)
- [x] 2.5 api-report-pub-search — re-run as single-lane wave 3 (2nd lane
      attempt also stalled mid-impl on a sonnet outage; orchestrator finished
      the remaining plan items, both Opus verifiers pass)
- [x] 2.6 api-analytics-activity-obs (Grok lane; import-sort fixup by
      orchestrator — add eslint check to grok lane spec)

## 3. Waves 7–14 — M-slices

- [x] 3.1 web-admin (wave 4)
- [x] 3.2 web-report-sections (wave 5)
- [x] 3.3 web-review (wave 4)
- [x] 3.4 web-slides (wave 4)
- [x] 3.5 web-landing-org-period (wave 5)
- [x] 3.6 web-app (wave 5)
- [x] 3.7 api-infrastructure (wave 6b — schema-limit re-run; pass/pass)
- [x] 3.8 api-period-carryover-archive (wave 6c; conservative: hygiene +
      13 carry-filter characterization pins, dual-state writers untouched;
      Codex cross-check skipped — CLI config error, 2 Opus lenses pass)
- [x] 3.9 api-comms (wave 6)
- [x] 3.10 packages-misc (wave 6)

## 4. Waves 15–16 — L-slices

- [x] 4.1 web-report-pages (wave 7; lead-form.tsx builder split skipped —
      trips the ratified declared-interface-seam guard; sync-bridge PERM
      max-lines exemption now technically retireable, see 5.1)
- [x] 4.2 api-sections-review (wave 7; 2 Opus lenses + Codex cross-review
      pass on invariants — Codex archaeology-comment majors fixed by
      orchestrator pre-commit)

## 5. Final sweep

- [ ] 5.1 Tear down obsolete eslint.config.ts exemptions (PERM blocks stay)
- [x] 5.1b ES2024 lib bump + Map.groupBy across all 11 flagged fold sites
      (Sasha signed off 2026-07-21). Council verify: 2 Opus lenses pass
      with zero findings, Codex pass with sparse-array-robustness minors
      (unreachable on dense Prisma/product inputs). Browser floor made
      explicit via apps/web browserslist (chrome/edge 117+, firefox 119+,
      safari 17.4+ — Map.groupBy baseline)
- [x] 5.2 Full gate: typecheck + lint (incl. depcruise, knip) + full vitest —
      green (1727 api / 2026 web / 12 shared tests)
- [x] 5.3 Codex spot-review, 8-file sample across waves 3-7: NO behavior,
      query/order, or side-effect drift found. Structural verdicts
      adjudicated: 2 mechanical mutation minors fixed (jobs-tab Set toggle,
      periods audit payload); the "still >50-line function" majors
      (JobsTab 156, createAdminPeriodsProcedures 167, use-item-edit-dialog
      composer 99) are in-wave-ratified single-responsibility units — the
      reject-list forbids splitting them further just to satisfy the
      counter; left as documented stragglers for Sasha's review
- [x] 5.4 Archive this change (Sasha signed off on 5.1b and accepted the
      5.3 stragglers as ratified single-responsibility units, 2026-07-21)
