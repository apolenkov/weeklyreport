# E2E Test Suite — CustomReport

## Quick Start

```bash
# Full fixture-based suite (requires auth setup)
pnpm --filter @customreport/web exec playwright test

# Regression suite (live dev stack, no auth setup needed)
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
```

## Suite Structure

```
e2e/
├── fixtures.ts                   role-scoped page factories (leadPage / headPage / adminPage)
├── auth.setup.ts                 writes .auth/*.json storage-state files
├── regression/                   live-stack regression specs (loginByCookie, no storageState dep)
│   ├── playwright.regression.config.ts
│   ├── helpers/dev-auth.ts
│   └── *.spec.ts
└── *.spec.ts                     fixture-based E2E specs
```

## Mandatory Scenarios

These must pass before every release. Failures block ship.

| Spec                                          | Scope                                 | Roles       |
| --------------------------------------------- | ------------------------------------- | ----------- |
| `lead-form.spec.ts`                           | Lead report CRUD — fill, submit, view | lead        |
| `publish-revoke.spec.ts` (non-fixme)          | Head publish/lock flow                | head        |
| `admin-panel.spec.ts`                         | Admin tabs: reminders, settings       | head, admin |
| `admin-reminder-policy.spec.ts`               | ReminderPolicy CRUD                   | admin       |
| `weekly-report.spec.ts`                       | Head weekly report view               | head        |
| `regression/lead-form-foreign-author.spec.ts` | Foreign-author read-only guard        | lead        |
| `regression/admin-groups.spec.ts`             | Admin groups management               | head, admin |

Run these with the regression config for CI:

```bash
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
```

## Advisory / Deferred Scenarios (`test.fixme`)

These are tracked as `test.fixme()` — visible in Playwright output as "fixme", not blocking.
They document planned coverage for features not yet implemented.

| Spec                             | Deferred scenarios                                                          | Blocking feature                        |
| -------------------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `publish-revoke.spec.ts`         | SC-156..158 Reopen, SC-160..167 Revoke                                      | Reopen/Revoke UI (v8.3)                 |
| `dashboard-advanced.spec.ts`     | SC-174 Send Reminder toast                                                  | API onClick wiring (v8.3)               |
| `a11y-advanced.spec.ts`          | SC-280 page titles, SC-283 Escape, SC-284 focus trap, SC-288 reduced motion | `<title>` metadata + dialog a11y (v8.3) |
| `weekly-report-advanced.spec.ts` | SC-200 Toggle All                                                           | React state click reliability (v8.3)    |

## Retired Tests

Specs that tested UI removed from the product:

- `admin-advanced.spec.ts` SC-227/SC-228 — Period create/edit UI removed in v8.1; period lifecycle is scheduler-owned
- `admin-panel.spec.ts` Periods Tab — same reason

## Auth Setup

The fixture-based suite requires storage-state files under `e2e/.auth/`:

```bash
pnpm --filter @customreport/web exec playwright test e2e/auth.setup.ts
# writes: e2e/.auth/lead.json, head.json, admin.json
```

The regression suite uses `loginByCookie()` directly — no setup step needed.

## Roles and Fixtures

| Fixture     | Role                     | Storage state      |
| ----------- | ------------------------ | ------------------ |
| `leadPage`  | lead1@customreport.local | `.auth/lead.json`  |
| `headPage`  | head1@customreport.local | `.auth/head.json`  |
| `adminPage` | admin@customreport.local | `.auth/admin.json` |
