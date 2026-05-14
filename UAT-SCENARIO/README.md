# UAT-SCENARIO Catalog

One DOM element = one or more test items. Every interactive or informational
element visible in the browser must have at least one PASS/FAIL verification
step here.

## Format

Each scenario file covers one screen or feature area. Files are numbered for
ordering (`01-landing.md`, `03-lead-form.md`, etc.).

### Item format

```
### <SCREEN-ID>.<NN> — <element description>

**Element:** `data-testid="..."` | `role="..."` | CSS selector
**Route:** /path/to/page
**Role:** lead | head | admin | viewer | director
**State precondition:** (e.g. "period open, lead has draft")

Steps:
1. Navigate to <route> and log in as <role>.
2. <action>
3. <action>

Expected: <what you should see>
Edge cases:
- <boundary condition> → <expected behaviour>

Playwright hook: `tests/e2e/<screen>.spec.ts` › `<SCREEN-ID>.<NN>`
```

### Status markers

- `[ ]` — not yet covered by automation
- `[P]` — Playwright test exists and passing
- `[M]` — manual-only (requires human visual judgment)
- `[S]` — skipped (deferred to a later phase, reason noted)

## Tooling

| Command              | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `pnpm uat:inventory` | Snapshot all interactive DOM elements for all role/route combos           |
| `pnpm uat:parse-dom` | Extract element list from .tsx source → `tools/uat-extractor/matrix.json` |
| `pnpm uat:generate`  | Generate Playwright stubs from UAT-SCENARIO/\*.md                         |
| `pnpm uat:coverage`  | Report % of DOM elements covered by at least one scenario item            |

## Files

| File                     | Screen                            | Items                                 |
| ------------------------ | --------------------------------- | ------------------------------------- |
| 01-landing.md            | Landing / login page              | auth, org hint, role picker           |
| 02-auth.md               | Auth flow                         | SAML, dev-login, redirects            |
| 03-lead-form.md          | Lead form                         | every section field, autosave, submit |
| 04-admin-users.md        | Admin → Users tab                 | activate/deactivate, filters          |
| 05-admin-periods.md      | Admin → Periods tab               | create, edit, archive                 |
| 06-admin-settings.md     | Admin → Settings tab              | org update, reminders                 |
| 07-admin-integrations.md | Admin → Integrations tab          | Telegram, Slack coming-soon           |
| 08-head-dashboard.md     | Head dashboard                    | submission widget, scope, KPI         |
| 09-head-report.md        | Head weekly report + presentation | slides, keyboard nav                  |
| 10-director-view.md      | Director view                     | deferred to A35                       |
| 99-cross-cutting.md      | Nav-bar, skeletons, hydration     | applies to all screens                |

## Coverage contract

Every PR that adds a new component or `data-testid` MUST add at least one
UAT-SCENARIO item. CI checks `pnpm uat:coverage` and fails if coverage drops.

Target: **100% DOM element coverage** (every `data-testid` has ≥1 scenario item).
Current: see `tools/uat-extractor/matrix.json` after running `pnpm uat:parse-dom`.
