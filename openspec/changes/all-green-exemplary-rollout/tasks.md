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

- [ ] 4.1 web-report-pages
- [ ] 4.2 api-sections-review

## 5. Final sweep

- [ ] 5.1 Tear down obsolete eslint.config.ts exemptions (PERM blocks stay)
- [ ] 5.1b Evaluate tsconfig lib ES2024 bump + Map.groupBy to replace the
      O(n^2) `new Map(acc).set()` immutable grouping folds W5 verifiers
      flagged (9 minor sites in report-sections groupers/stage-tags/
      next-week-columns) — runtime-compat decision, needs Sasha's sign-off
- [ ] 5.2 Full gate: typecheck + lint (incl. depcruise, knip) + full vitest
- [ ] 5.3 Codex spot-review of a random sample across waves
- [ ] 5.4 Archive this change; update campaign artifacts
