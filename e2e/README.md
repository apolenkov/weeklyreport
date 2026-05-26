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
| `lead-form-crud.spec.ts`                      | Lead report CRUD — fill, submit, view | lead        |
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
They document planned coverage for features blocked by a design decision or missing UI.

| Spec                     | Scenario IDs             | Blocking reason                                 |
| ------------------------ | ------------------------ | ----------------------------------------------- |
| `publish-revoke.spec.ts` | SC-160, SC-162..SC-166   | Dashboard-level Revoke UI — design decision     |
| `a11y-advanced.spec.ts`  | SC-280×2                 | `<title>` metadata exports in route pages       |
| `a11y-advanced.spec.ts`  | SC-283 (lead submit Esc) | `onKeyDown` Esc handler on lead submit dialog   |
| `a11y-advanced.spec.ts`  | SC-284                   | Focus-trap (Radix focus-scope) in modal dialogs |

## UI-Gated Stubs

The following stubs require specific UI or infrastructure that does not yet exist.
They remain as `test.fixme` until the prerequisite feature is implemented in a future phase.

| #   | SC ID       | File                     | Required UI / code                                      | Phase           |
| --- | ----------- | ------------------------ | ------------------------------------------------------- | --------------- |
| 1   | SC-280 (×2) | `a11y-advanced.spec.ts`  | `metadata` exports in route page files                  | next UI phase   |
| 2   | SC-283 lead | `a11y-advanced.spec.ts`  | `onKeyDown` Escape handler on lead form submit dialog   | next UI phase   |
| 3   | SC-284      | `a11y-advanced.spec.ts`  | Focus-trap (Radix `FocusScope`) inside modal dialogs    | next UI phase   |
| 4   | SC-160      | `publish-revoke.spec.ts` | Dashboard-level Revoke button in `lead-report-card.tsx` | DESIGN DECISION |
| 5   | SC-162      | `publish-revoke.spec.ts` | Revoke flow wired to API (depends on SC-160)            | after SC-160    |
| 6   | SC-163      | `publish-revoke.spec.ts` | Revoke flow wired to API (depends on SC-160)            | after SC-160    |
| 7   | SC-164      | `publish-revoke.spec.ts` | Full revoke + re-submit mutation cycle                  | after SC-160    |
| 8   | SC-165      | `publish-revoke.spec.ts` | Bulk Revoke All action                                  | after SC-160    |
| 9   | SC-166      | `publish-revoke.spec.ts` | Revoke during Published state (reopen-first guard)      | after SC-160    |

**SC-160 design decision:** A dashboard-level Revoke button does not yet exist in `lead-report-card.tsx`.
The in-form Revoke (SC-161, now active) serves as the primary head action for the current UAT.
SC-162–166 are derivatives — they are unblocked once SC-160 is decided and implemented.

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
