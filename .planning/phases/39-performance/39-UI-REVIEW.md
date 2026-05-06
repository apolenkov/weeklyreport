---
phase: 39
phase_name: "performance"
reviewed_at: "2026-05-06T23:30:00+03:00"
mode: code-only
status: findings
overall_score: 16
max_score: 24
scores:
  copywriting: 3
  visuals: 3
  color: 2
  typography: 3
  spacing: 3
  experience_design: 2
files_reviewed:
  - apps/web/src/components/search/search-input.tsx
  - apps/web/src/app/(app)/reports/page.tsx
  - apps/web/src/components/admin/products-tab.tsx
  - apps/web/src/components/search/search-input.test.tsx
---

# Phase 39 UI Review: Performance

Scope: retroactive 6-pillar audit for the Phase 39 search UI shipped in
Plan 39-05. This was a code-only review; no Playwright screenshots were
available in this session.

## Scorecard

| Pillar            | Score | Notes                                                                                            |
| ----------------- | ----: | ------------------------------------------------------------------------------------------------ |
| Copywriting       |   3/4 | Russian placeholders fit the product, but result type labels and hidden label remain English.    |
| Visuals           |   3/4 | Search dropdown is compact, readable, and consistent with the app shell.                         |
| Color             |   2/4 | Focus, hover, active, and highlight all reuse the same success tint, reducing state distinction. |
| Typography        |   3/4 | Good hierarchy, but 11px uppercase badges are dense for repeated scan use.                       |
| Spacing           |   3/4 | Input respects 44px touch target; result rows are compact but acceptable.                        |
| Experience Design |   2/4 | Viewer scope mismatch, missing error state, and incomplete combobox ARIA are material gaps.      |

Overall: **16/24**.

## Findings

### HIGH: Viewer search can call a forbidden scope

`apps/web/src/app/(app)/reports/page.tsx:92` passes
`scope={isLead ? 'mine' : 'all'}`. That means viewers also get `scope="all"`,
but the Phase 39 backend gates `all` to head/admin. On the published reports
page, a viewer can see the search box and trigger a forbidden query.

Fix: use role-specific scope and/or hide org-wide search for viewers until a
published-only search scope exists. At minimum, pass `all` only for head/admin.

### MEDIUM: Search has no visible error state

`apps/web/src/components/search/search-input.tsx:115` reads only `data` and
`isFetching` from `useQuery`. It does not read `isError` / `error`, so failed
search requests collapse into an empty or stale-looking dropdown. This makes
the viewer forbidden case above look like "nothing happened".

Fix: render a small inline error row in the listbox and add a test for 403 or
generic query failure.

### MEDIUM: Combobox keyboard state is not announced fully

The input exposes `role="combobox"` and points to `aria-controls`, but options
do not have stable IDs and the input does not set `aria-activedescendant`.
Keyboard navigation works visually, but assistive tech has no reliable active
option reference.

Fix: assign IDs to options and set `aria-activedescendant` on the input when a
hit is highlighted.

### LOW: Search copy mixes Russian UI with English taxonomy

The reports page and products tab use Russian placeholders, while result badges
display `Item`, `Risk`, `Decision`, `Project`, and the hidden label is
`Search reports`. This is minor, but it breaks the otherwise Russian operational
surface.

Fix: localize badge labels and the hidden label, or intentionally standardize
the report taxonomy in English across the full app.

### LOW: Project result target advertises a filter that is not consumed

`targetUrlFor` sends project hits to `/admin?tab=products&filter=<projectId>`.
The Phase 39 summary notes that `filter` is not yet read by `products-tab`.
The click still lands in the right area, but the matched project is not
highlighted or scrolled into view.

Fix: read `filter` in the products tab and expand/highlight the matching
project, or remove the query param until it has behavior.

## Strengths

- The search input has a clear 2-character floor, 300ms debounce, keyboard
  navigation, click-through routing, outside-click close, and snippet
  highlighting.
- The admin placement is sensible: `scope="all"` appears in an admin/head-only
  surface, with server-side authorization still treated as the real gate.
- The component is small enough to keep future URL-shape changes localized in
  `targetUrlFor`.

## Recommended Fix Order

1. Fix the role-to-scope mapping on `/reports` and add a viewer regression test.
2. Add visible query error handling to `SearchInput`.
3. Complete ARIA active-option wiring for the combobox.
4. Localize badge labels and hidden label.
5. Implement or remove the products `filter` query behavior.
