## 1. Wave 1 — calibration (S-slices + defect tests)

- [x] 1.1 web-analytics, web-pdf-export, web-viewer-telemetry, web-dashboard:
      regrade live violations, fix to standard, resolve seed minors
- [x] 1.2 Defect tests verified already fixed pre-campaign (64834f55,
      4d3e4051, 2026-07-17); both pass targeted, no edits needed
- [x] 1.3 Calibration verdict: splits follow real responsibilities, verifiers
      caught one undisclosed render-token swap (accepted as ratified
      tokenization); harness approved for scale-out

## 2. Waves 2–6 — remaining S-slices

- [ ] 2.1 web-shared
- [ ] 2.2 web-lib
- [ ] 2.3 api-lib
- [ ] 2.4 api-auth-admin (load-bearing: auth; cross-vendor review)
- [ ] 2.5 api-report-pub-search
- [ ] 2.6 api-analytics-activity-obs

## 3. Waves 7–14 — M-slices

- [ ] 3.1 web-admin
- [ ] 3.2 web-report-sections
- [ ] 3.3 web-review
- [ ] 3.4 web-slides
- [ ] 3.5 web-landing-org-period
- [ ] 3.6 web-app
- [ ] 3.7 api-infrastructure
- [ ] 3.8 api-period-carryover-archive (load-bearing: period dual-state)
- [ ] 3.9 api-comms
- [ ] 3.10 packages-misc

## 4. Waves 15–16 — L-slices

- [ ] 4.1 web-report-pages
- [ ] 4.2 api-sections-review

## 5. Final sweep

- [ ] 5.1 Tear down obsolete eslint.config.ts exemptions (PERM blocks stay)
- [ ] 5.2 Full gate: typecheck + lint (incl. depcruise, knip) + full vitest
- [ ] 5.3 Codex spot-review of a random sample across waves
- [ ] 5.4 Archive this change; update campaign artifacts
