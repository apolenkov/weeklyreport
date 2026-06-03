# Lead Catalog — Coverage Matrix

Completeness critic pass against discovered routes. Date: 2026-06-04.

Discovered routes (10):
`/`, `/lead/report`, `/lead/report/[reportId]`, `/lead/report/[reportId]/preview`,
`/lead/history`, `/reports`, `/reports/[reportId]`, `/reports/[reportId]/present`,
`/reports/history`, `/reports/trends`

## Coverage matrix

| Route                              | Intent count | Covered? |
|------------------------------------|:------------:|:--------:|
| `/`                                | 4            | yes      |
| `/lead/report`                     | 2            | yes      |
| `/lead/report/[reportId]`          | 17           | yes      |
| `/lead/report/[reportId]/preview`  | 5            | yes      |
| `/lead/history`                    | 1            | yes      |
| `/reports`                         | 4            | yes      |
| `/reports/[reportId]`              | 5            | yes      |
| `/reports/[reportId]/present`      | 4            | yes      |
| `/reports/history`                 | 1            | yes      |
| `/reports/trends`                  | 1            | yes      |

**Routes total:** 10 | **Routes with >= 1 intent:** 10 | **Uncovered:** 0 |
**Total intent entries:** 44 | **Duplicate ids:** none

## Findings

### 1. Uncovered routes

None. All 10 discovered routes have at least one intent.

### 2. Structural leaks (file:line / CSS selector / test name smuggled into intent)

None found. No `file:line` references, `data-testid`, CSS class selectors, or
test function names appear in any `intent`, `given`, `when`, or `then` field
across all 44 intents.

Implementation-detail mentions in `note` fields (e.g. component names like
`ItemEditDialog`, tRPC query names, Next.js Link) are acceptable — they appear
only in `note`, not in observable outcome fields.

### 3. Vacuous "then" clauses

None found. Every `then` names at least one concrete observable:

- URL or navigation destination (most intents)
- HTTP redirect status code (307 for `/lead/history`, `/reports/history`)
- Named toast text ('Report submitted', 'Reopen request sent to Head', etc.)
- Visible UI element state change (button text, read-only banner, badge count,
  button disappearance, accordion expansion)
- File download trigger (PDF export intents)
- Chart render with named data ranges (`/reports/trends`)

The shortest `then` (`lead-auto-redirect-to-report`: "window.location.replace
sends the user to /lead/report", 54 chars) is brief but unambiguous — the URL
destination is the observable. Not vacuous.

## Summary

The catalog is complete and clean at entry-point level. No action required
before the next Driver run.
