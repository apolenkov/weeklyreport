# Admin Catalog — Coverage Matrix

Completeness critic pass against discovered routes. Date: 2026-06-07.

Discovered routes (18):
`/`, `/admin`, `/admin/products`, `/admin/settings`, `/head/dashboard`,
`/head/history`, `/head/report`, `/head/report/[reportId]`,
`/head/report/[reportId]/present`, `/head/slides`, `/lead/history`,
`/lead/report`, `/lead/report/[reportId]`, `/reports`, `/reports/[reportId]`,
`/reports/[reportId]/present`, `/reports/history`, `/reports/trends`

## Coverage matrix

| Route                             | Intent count | Covered? |
| --------------------------------- | :----------: | :------: |
| `/`                               |      4       |   yes    |
| `/admin`                          |      9       |   yes    |
| `/admin/products`                 |      8       |   yes    |
| `/admin/settings`                 |      5       |   yes    |
| `/head/dashboard`                 |      5       |   yes    |
| `/head/history`                   |      1       |   yes    |
| `/head/report`                    |      5       |   yes    |
| `/head/report/[reportId]`         |      8       |   yes    |
| `/head/report/[reportId]/present` |      3       |   yes    |
| `/head/slides`                    |      1       |   yes    |
| `/lead/history`                   |      1       |   yes    |
| `/lead/report`                    |      1       |   yes    |
| `/lead/report/[reportId]`         |      1       |   yes    |
| `/reports`                        |      4       |   yes    |
| `/reports/[reportId]`             |      6       |   yes    |
| `/reports/[reportId]/present`     |      3       |   yes    |
| `/reports/history`                |      5       |   yes    |
| `/reports/trends`                 |      1       |   yes    |

**Routes total:** 18 | **Routes with >= 1 intent:** 18 | **Uncovered:** 0
**Total intent entries:** 71

## Findings

### 1. Uncovered routes

None. All 18 discovered routes have at least one intent.

**Route key drift note:** The catalog labels the settings route as
`/admin/settings (307 redirect to /admin?tab=settings)` rather than the bare
`/admin/settings` from the discovered list. The route is covered (5 intents),
but the parenthetical annotation is embedded in the route key string itself
instead of in a `note` field. This will cause a string-match mismatch in any
tool that compares route keys to discovered paths. Move the annotation to a
`note` field on the route block. Additionally, `access: []` is empty for this
route — it should list `[admin]` like every other route in this catalog.

### 2. Structural leaks (CSS selector / implementation detail smuggled into intent fields)

One violation found in a `note:` field within an intent block:

- **`/reports/[reportId]/present :: admin-report-present-navigate-sections`**
  — the `note:` field contains a DOM data-attribute selector
  `[data-product-accordion-toggle]`. A test selector belongs in the driver
  implementation, not in the behavioral catalog. Replace with a behavioral
  description such as "section scroll targets are product accordions in the
  rendered report."

### 3. Vacuous "then" clauses

None found. All 71 `then` fields name at least one concrete, externally
observable outcome:

- Named toast text for all mutation intents
  (e.g. "Period published & locked", "User saved", "Policy removed")
- URL or navigation destination for redirect and navigation intents
- HTTP redirect code and landing surface (e.g. 307 to /reports?tab=published)
- Visible UI state changes (button label toggle, badge count, row refresh,
  accordion state, section counter "N / M")
- File download or new-tab open for PDF export intents
- Named chart series for the trends dashboard

## Summary

Complete at entry-point level: 18 of 18 routes covered, 71 total intents across
18 routes. No vacuous thens. One structural leak: a DOM data-attribute selector
`[data-product-accordion-toggle]` in the `note:` of
`/reports/[reportId]/present :: admin-report-present-navigate-sections`. The
`/admin/settings` route key also needs its parenthetical annotation moved to a
`note` field and `access: []` corrected to `[admin]`.
