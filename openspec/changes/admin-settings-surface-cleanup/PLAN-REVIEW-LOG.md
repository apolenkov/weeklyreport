# Plan Review Log: admin-settings-surface-cleanup

Act 1 (grill-with-docs) complete — change locked, CONTEXT.md updated
(Period policy / Period management glossary terms added). MAX_ROUNDS=5.

## Round 1 — Codex

VERDICT: REVISE. Sanity-checked the 4-dead/11-live claim: confirmed. Nine flaws:

1. Holidays scenario calls the trigger "inert" but only the nested label is inert; the trigger stays selectable.
2. Late-submission help text is semantically REVERSED vs the API (grace honored regardless of the switch; switch only governs past-grace).
3. UI disables auto-publish unless auto-create, but the scheduler checks only autoPublishAfterDeadline — a false dependency.
4. deadlineTime "working" overstated: minutes truncated on manual create, scheduler hardcodes 18:00.
5. The honest-help requirement has only one illustrative scenario — 10 fields uncovered.
6. Removal acceptance checks only form + payload, not the read DTO / shared schema / Prisma model.
7. e2e/catalog/admin.yaml still requires the 4 removed controls + CI/Slack/"AI Summary" — no task updates it.
8. Blast radius omits prisma/seed.ts + seed-simple.ts which write all 4 columns — migrate reset + seed would break.
9. The save toast still says "Period settings"; CONTEXT says use "Period policy" for org policy.

### Claude's response

All nine confirmed against code (read report-sections.service:200, auto-publisher.scheduler:59, period-admin.service:240, period-creator.scheduler:116, seed.ts:1343, seed-simple.ts:364, e2e/catalog/admin.yaml:174). ACCEPT all nine. Findings 2/3 promote from "fix copy" to small honesty BEHAVIOR fixes (drop the false auto-create dependency; correct the reversed grace/late copy), consistent with the change's honesty goal. Finding 4 → describe deadlineTime honestly (whole-hour manual default; scheduler uses 18:00), no scope expansion to wire minutes. Revised proposal/spec/design/tasks accordingly.

## Round 2 — Codex

VERDICT: REVISE. Prior findings 2,3,4,6,8 resolved. Six remaining (precision/completeness):

1. proposal still calls the Holidays affordance itself "inert" — should scope inertness to the nested label.
2. honest-copy scenario still doesn't enumerate all 11 fields (omits periodLengthDays, defaultDeadlineDays, workingDays, autoArchiveWeeksAfterPublish, allowReopenAfterPublish, reopenWindowHours).
3. save-copy contract says "Period policy" exactly but the phrase-replace yields "Save Period Policy"/"Period policy saved" — specify exact strings.
4. catalog task omits the Save-copy rename + the auto-publish note in e2e/catalog/admin.yaml.
5. design decision 2 still says behavior untouched while removing the disabled guard does change UI behavior — reword.
6. test blast radius misses shared report.test.ts, web mappers admin.test.ts, and the existing period-field/auto-publish assertions in settings-tab.test.tsx.

### Claude's response

All six are legitimate precision/completeness fixes (no new substantive defect — converging). ACCEPT all: reworded proposal Holidays bullet + design decision 2; enumerated all 11 fields in the scenario; specified exact save strings in spec + task; extended the catalog task; added the three test files to 7.1/7.2.

## Round 3 — Codex

VERDICT: APPROVED. All six round-2 findings resolved; strict validation passes;
no new concrete blockers. Converged in 3 rounds.
