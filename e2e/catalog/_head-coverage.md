# Head Catalog — Coverage Matrix

Completeness critic pass against discovered routes. Date: 2026-06-07.
Previous pass results replaced; counts below reflect `head.yaml` as it stands today.

Discovered routes (15):
`/`, `/head/dashboard`, `/head/history`, `/head/slides`, `/head/report`,
`/head/report/[reportId]`, `/head/report/[reportId]/present`,
`/lead/history`, `/lead/report`, `/lead/report/[reportId]`,
`/reports`, `/reports/[reportId]`, `/reports/[reportId]/present`,
`/reports/history`, `/reports/trends`

## Coverage matrix

| Route                             | Intent count | Covered? |
| --------------------------------- | :----------: | :------: |
| `/`                               |      1       |   yes    |
| `/head/dashboard`                 |      6       |   yes    |
| `/head/history`                   |      1       |   yes    |
| `/head/slides`                    |      1       |   yes    |
| `/head/report`                    |      1       |   yes    |
| `/head/report/[reportId]`         |      8       |   yes    |
| `/head/report/[reportId]/present` |      4       |   yes    |
| `/lead/history`                   |      1       |   yes    |
| `/lead/report`                    |      1       |   yes*   |
| `/lead/report/[reportId]`         |      1       |   yes    |
| `/reports`                        |      5       |   yes    |
| `/reports/[reportId]`             |      4       |   yes    |
| `/reports/[reportId]/present`     |      5       |   yes    |
| `/reports/history`                |      1       |   yes    |
| `/reports/trends`                 |      1       |   yes    |

\* Route key in the YAML is malformed: written as `route: /lead/report (access: head)`
with `access: []` instead of a clean `route: /lead/report` + `access: [head]`.
The intent `head-routed-away-from-lead-form` covers the route despite the malformed key.
Any tool that key-matches on the route string will miss this entry; fix on next regeneration.

**Routes total:** 15 | **Routes with >= 1 intent:** 15 | **Uncovered:** 0
**Total intent entries:** 41

## Findings

### 1. Uncovered routes

None. All 15 discovered routes have at least one intent in the catalog.

Note: the previous pass flagged `/head/slides` as uncovered (empty `intents:` block).
That gap has been filled — the route now carries `head-slides-history-alias` describing
the legacy alias redirect behavior.

### 2. Structural leaks (file:line / CSS selector / test name)

None found.

Patterns checked across all `given`, `when`, `then`, and `note` fields:

- **file:line** (`path/to/file.ts:123`): not present.
- **CSS/DOM selectors** (`#fragment`, `.class-name`, `[data-*]`): not present.
  The previous pass found `#section-<sectionId>` in `/reports :: head-search-compiled-history`;
  that intent no longer exists in the catalog — it was superseded by `head-search-all-reports`,
  whose `then` contains no selector.
- **Test function names** (`describe(`, `it(`, `test(`): not present.

tRPC call names in `note` fields (e.g., `trpc.period.publish`, `leadForm.revokeAllSubmitted`,
`trpc.reports.compiledHistory.queryOptions({ includeArchive })`) are API identifiers, not
CSS/test selectors or file:line references. They do not violate the format contract.
They are implementation detail and should be softened to behavioral prose on next
regeneration, but are not blocking structural leaks.

### 3. Vacuous "then" clauses

None. Every `then` across all 41 intents names at least one concrete observable:

- Explicit navigation destination with query params preserved
  (`/head/dashboard`, `/reports?tab=published`, `/head/report/<reportId>/present`, etc.)
- Quoted toast text
  (`'Period published & locked'`, `'Period reopened'`, `'Report archived'`, `'Sent'`)
- Explicit state transition with visible UI update
  (status → Draft, button → disabled, section counter increments/decrements)
- 307-redirect target URL with tab param
  (`/lead/history`, `/reports/history`, `/head/history`, `/head/slides`)
- Rich chart description with named fallback states (`/reports/trends`)

Borderline case reviewed: `head-addressed-report-navigate-presentation` then reads
`"navigation occurs to /head/report/<reportId>/present"` — short but not vacuous;
the specific target URL is a concrete observable.

Borderline case reviewed: `head-present-toggle-fullscreen` then reads
`"The wrapper enters or exits browser fullscreen; the button label updates to reflect
the current state"` — "to reflect the current state" is vague about the exact label.
Not vacuous (entering/exiting fullscreen is observable), but the label change could
name the two states explicitly ("Fullscreen" / "Exit fullscreen") on next regeneration.

### 4. Observations (not blocking findings)

**Malformed route key.** `/lead/report` is entered as
`route: /lead/report (access: head)` with `access: []`. Fix on next regeneration:
use `route: /lead/report` + `access: [head]`.

**`/reports/[reportId]/present` contains publish/reopen/archive intents.**
Three intents on this route (`head-publish-lock-period`, `head-reopen-published-period`,
`head-archive-published-report`) duplicate mutation intents already present on
`/head/report/[reportId]`. If the presentation view truly exposes these controls,
the duplication is correct. Verify against the actual component on next regeneration.

**`head-present-toggle-fullscreen` then clause** could be sharpened: the label change
should name both states ("Fullscreen" → "Exit fullscreen") rather than "to reflect the
current state."

## Summary

Entry-point completeness: **15 / 15 routes covered. 0 uncovered routes.**

No structural leaks found.

No vacuous `then` clauses found.

Two non-blocking observations for next regeneration:

1. Fix malformed route key `/lead/report (access: head)` → `/lead/report` + `access: [head]`.
2. Sharpen `head-present-toggle-fullscreen` then clause to name both button label states.
