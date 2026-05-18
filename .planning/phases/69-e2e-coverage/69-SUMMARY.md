---
phase: 69
title: E2E Coverage — skip retirement, README, foreign-author verify
status: passed
milestone: v8.2
completed: 2026-05-18
---

# Phase 69 — E2E Coverage

## Goal

Resolve 3 `describe.skip` blocks; verify foreign-author regression spec in config; document mandatory vs advisory scenarios.

## Deliverables

### Retired `describe.skip` blocks (3)

Period create/edit UI was removed in v8.1 — period lifecycle is scheduler-owned (`PeriodCreatorScheduler`). Dead test code retired with explanatory comments.

- `apps/web/e2e/admin-advanced.spec.ts`: SC-227 (Create New Period) + SC-228 (Period Date Entry) — removed
- `apps/web/e2e/admin-panel.spec.ts`: Admin Panel Periods Tab — removed

### Foreign-author regression spec

`apps/web/e2e/regression/lead-form-foreign-author.spec.ts` confirmed in regression config. Config uses `testDir: "."` — all files in `e2e/regression/` are included automatically.

### `test.fixme()` inventory confirmed

All 20 deferred stubs already correctly use Playwright-native `test.fixme()` — they appear in the test runner output as "fixme" and do not block CI. No conversion needed.

Deferred to v8.3 with `test.fixme()`:

- SC-156..158 Reopen flow (publish-revoke.spec.ts)
- SC-160..167 Revoke flow (publish-revoke.spec.ts)
- SC-174 Send Reminder API toast (dashboard-advanced.spec.ts)
- SC-280 page titles / SC-283 Escape / SC-284 focus trap / SC-288 reduced motion (a11y-advanced.spec.ts)
- SC-200 Toggle All (weekly-report-advanced.spec.ts)

### `e2e/README.md` created

Documents:

- Suite structure (fixture-based vs regression)
- Mandatory scenarios (must pass pre-release)
- Advisory / deferred scenarios (test.fixme — why deferred, which v8.3 feature unblocks)
- Retired tests (removed UI, reason)
- Auth setup instructions
- Role/fixture mapping table

## Verification

```bash
grep -rn "describe\.skip" apps/web/e2e/ --include="*.ts"  # 0 matches
cat apps/web/e2e/README.md  # exists with mandatory/advisory tables
ls apps/web/e2e/regression/lead-form-foreign-author.spec.ts  # exists
```

## Status

`passed` — 3 skip blocks retired, foreign-author spec confirmed, README created.
