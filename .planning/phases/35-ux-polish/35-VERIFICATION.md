---
phase: 35-ux-polish
verified: 2026-05-08
status: partial
score: UX fixes shipped, product-ready feedback still has follow-ups
---

# Phase 35: UX Polish Verification

## Verdict

Status: partial.

Phase 35 delivered the main UX polish work, but the 2026-05-08 manual UAT
reopened product-ready follow-ups. This file exists to make that explicit
rather than counting the phase as silently verified.

## Verified Evidence

| Area                          | Evidence                                       | Status   |
| ----------------------------- | ---------------------------------------------- | -------- |
| Stage assignment counter      | 35-01 summary and admin count query            | verified |
| Role default route            | 35-08 summary                                  | verified |
| Reports tabs merge            | 35-08 summary                                  | verified |
| Activity panel                | 35-08 summary and later UI review              | partial  |
| Static text policy            | UI review 2026-05-07                           | partial  |
| Active nav query tabs         | fixed after manual UAT, covered by nav tests   | verified |
| Addressable head report route | browser smoke redirects lead URL to head route | verified |

## Open Follow-ups

| Gap                                                                  | Source                                    | Status                 |
| -------------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| Phase 17 visual UAT still pending                                    | .planning/phases/17-ui-redesign/17-UAT.md | human_needed           |
| Hover geometry and empty-product affordance need scenario evidence   | product-ready retro                       | needs browser proof    |
| Activity row drill-down semantics need sustained regression coverage | UI review                                 | needs regression proof |
| Persistent action log is a new product feature, not phase 35 closure | log coverage audit                        | deferred               |

## Closure Requirement

Phase 35 can be marked fully verified only after the phase 17 UAT rows that
cover navigation, dashboard, weekly report, admin, print/PDF, and design system
are updated with actual browser evidence.
