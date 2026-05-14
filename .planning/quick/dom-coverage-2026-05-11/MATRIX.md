---
generated: 2026-05-11
ticket: UFB-064
routes_scanned: 17
testable_elements_total: 165
covered_by_e2e: 82
covered_by_unit: 6
uncovered: 77
coverage_percent: 53.3
methodology: |
  Sweep apps/web/src/**/*.tsx for data-testid, aria-label, aria-labelledby,
  and role attributes. Sweep apps/web/e2e/**/*.spec.ts (top-level, regression,
  integration, a11y, responsive, visual) for getByTestId / getByRole /
  getByLabel / getByText / raw [data-testid="..."] CSS selectors. Cross-match
  by literal string and templated-key prefix.
  Templated testIds (e.g. `periods-row-${row.id}`) counted as one element each.
  Counts include only attributes attached to interactive or assertable nodes;
  decorative aria-labels (e.g. icon labels inside KPI cards) listed but ranked
  low priority.
sample_caveats: |
  - aria-label string match is exact-substring; a templated label like
    `Edit ${user.name}` is counted as one bucket and considered covered if any
    spec uses `Edit Maria Ivanova` or a regex match.
  - Native <button> with visible text but no aria-label and no testid is
    counted as covered when getByRole('button', { name: 'X' }) matches the
    button text. There are 119 <button>/<Button> instances; ~60 have explicit
    label or testid hooks, the remaining ~59 are text-named buttons.
  - Coverage % is conservative; real interactive coverage (i.e. buttons +
    inputs that the user can hit) sits around 55-60%, asserted state coverage
    around 75-80%.
---

## 0. Top-line numbers

| Bucket                                 | Count                                       |
| -------------------------------------- | ------------------------------------------- |
| Unique data-testid (static)            | 48                                          |
| Templated testId families              | 16                                          |
| Unique aria-label (static)             | 56                                          |
| Templated aria-label families          | 27                                          |
| `role="dialog"` declarations           | 13                                          |
| `role="menuitem"`                      | 3                                           |
| `role="combobox"`                      | 1                                           |
| Native `<button>` / `<Button>`         | 119                                         |
| `<Link>` / `<a href>`                  | 2                                           |
| **Total addressable** (unique buckets) | **~165**                                    |
| Covered by Playwright e2e              | 82                                          |
| Covered by Vitest unit only            | 6 (if-role, lead-form, period-summary-tabs) |
| Uncovered                              | 77                                          |

```
[src DOM hooks 165] ──┐
                       ├─→ [overlap ≈ 88 covered] ──→ coverage 53.3 %
[e2e hooks   ~264] ──┘
                          [uncovered 77] ── priority queue § 4
```

---

## 1. Inventory by route

### 1.1 `/` (landing) — `apps/web/src/app/page.tsx`

| element                                  | type                  | source                    |
| ---------------------------------------- | --------------------- | ------------------------- |
| Sign-in CTA `Sign in with corporate SSO` | `<button>` text-named | page.tsx:186              |
| `aria-label="Your PULSE"` (logo)         | aria-label            | landing/pulse-mark.tsx:20 |
| Heading `CustomReport`                   | h1                    | page.tsx                  |
| Heading `Core Development`             | h2                    | page.tsx                  |

### 1.2 `/auth/error` — `apps/web/src/app/auth/error/page.tsx`

| element                        | type               | source                 |
| ------------------------------ | ------------------ | ---------------------- |
| `Return to login page`         | aria-label on link | auth/error/page.tsx:32 |
| Heading `Authentication Error` | h1                 | page.tsx               |

### 1.3 `/admin` (umbrella shell) — `apps/web/src/app/(app)/admin/page.tsx` + `components/admin/admin-panel.tsx`

| element                           | type                 | source                                                                                                                    |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `data-testid="admin-panel"`       | testid wrapper       | admin-panel.tsx:65                                                                                                        |
| `aria-label="Admin tabs"` (nav)   | aria-label           | admin/page.tsx:70                                                                                                         |
| `aria-label={`${tab} tab`}` × N   | templated aria-label | admin/page.tsx:83 (resolves to Users / Groups / Products / Periods / Reminders / Reopen / Jobs / Actions / Settings tabs) |
| `aria-label="Admin tab"` (mobile) | aria-label           | admin-tabs-mobile-select.tsx:53                                                                                           |
| Heading `Admin Panel`             | h1                   | admin/page.tsx                                                                                                            |

### 1.4 `/admin?tab=users` — `components/admin/users-tab.tsx`

| element                                        | testId / aria | line      |
| ---------------------------------------------- | ------------- | --------- |
| `data-testid="users-table"`                    | testid        | 177       |
| `aria-label="Add new user"`                    | aria          | 167       |
| `aria-label={`Edit ${user.name}`}` (per-row)   | templated     | 221       |
| `aria-label={`Delete ${user.name}`}` (per-row) | templated     | 229       |
| `data-testid="crud-sheet"` (edit/add sheet)    | testid        | 253       |
| `aria-label="Edit user" / "Add user"` (dialog) | templated     | 259       |
| `aria-label="Confirm delete"`                  | aria          | 377       |
| Form fields: `Name`, `Email`, `Role`, `Group`  | label assoc   | users-tab |

### 1.5 `/admin?tab=groups` — `components/admin/groups-tab.tsx`

| element                                                                                                                 | testId / aria | line       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| `data-testid="groups-tab"`                                                                                              | testid        | 150        |
| `data-testid="groups-table"`                                                                                            | testid        | 183        |
| `aria-label="Add group"`                                                                                                | aria          | 172        |
| `aria-label={`Edit ${group.name}`}`                                                                                     | templated     | 238        |
| `aria-label={`Archive ${group.name}`}`                                                                                  | templated     | 247        |
| `aria-label="Edit group" / "Add group"` (sheet)                                                                         | templated     | 278        |
| `aria-label="Confirm archive"`                                                                                          | aria          | 407        |
| `data-testid="crud-sheet"`                                                                                              | testid        | 272        |
| Form fields: `Name`, `Description`                                                                                      | label assoc   | groups-tab |
| sub-component `<GroupProductsEditor>` testids: `group-products-editor`, `group-products-loading`, `group-products-list` | testid        | 91/104/115 |
| `aria-label={`Toggle ${product.name}`}` (chip toggle)                                                                   | templated     | 127        |

### 1.6 `/admin?tab=products` — `components/admin/products-tab.tsx`

| element                                                                                                        | testId / aria | line                                |
| -------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------- |
| `data-testid="products-table"`                                                                                 | testid        | 208                                 |
| `aria-label="Add new product"`                                                                                 | aria          | 186                                 |
| `aria-label={`Expand stage assignments for ${product.name}`}`                                                  | templated     | 225                                 |
| `aria-label={`Edit ${product.name}`}`                                                                          | templated     | 250                                 |
| `aria-label={`Archive ${product.name}`}`                                                                       | templated     | 259                                 |
| `aria-label={`Restore ${product.name}`}`                                                                       | templated     | 301                                 |
| `aria-label="Edit product" / "Add product"` (dialog)                                                           | templated     | 322                                 |
| stage editor `aria-label={`Assign ${stage} stage for ${project}`}`                                             | templated     | stage-assignment-editor.tsx:153     |
| `<ProductGroupChips>`: `product-group-chips`, `-loading`, `-empty` + `aria-label="Groups owning this product"` | testid + aria | product-group-chips.tsx:30/42/52/53 |

### 1.7 `/admin?tab=periods` — `components/admin/periods-tab.tsx`

| element                                                                                           | testId / aria | line                   |
| ------------------------------------------------------------------------------------------------- | ------------- | ---------------------- |
| `data-testid="periods-active-loading"`                                                            | testid        | 145                    |
| `data-testid="periods-active-empty"`                                                              | testid        | 152                    |
| `data-testid="periods-archive-toggle"`                                                            | testid        | 177                    |
| `data-testid="periods-archive-body"`                                                              | testid        | 188                    |
| `data-testid="periods-archive-loading"`                                                           | testid        | 192                    |
| `data-testid="periods-archive-empty"`                                                             | testid        | 199                    |
| `data-testid={`periods-${prefix}-table`}`                                                         | templated     | 244                    |
| `data-testid={`periods-${prefix}-row-${id}`}`                                                     | templated     | 297                    |
| `data-testid={`periods-row-${id}-reopened-badge`}`                                                | templated     | 309                    |
| `data-testid={`state-badge-${state}`}`                                                            | templated     | 350                    |
| `data-testid={`periods-row-${rowId}-progress`}`                                                   | templated     | 378/397                |
| `aria-label={`Actions for period ${id}`}`                                                         | templated     | 493                    |
| `data-testid={`action-menu-trigger-${id}`}`                                                       | templated     | 494                    |
| `data-testid={`action-menu-${id}`}`                                                               | templated     | 502                    |
| `aria-label="Create new period"` (header CTA — covered by spec `getByLabel("Create new period")`) | aria          | admin-advanced.spec.ts |

### 1.8 `/admin?tab=reminders` — `components/admin/reminders-tab.tsx`

| element                                                                             | testId / aria | line                          |
| ----------------------------------------------------------------------------------- | ------------- | ----------------------------- |
| `data-testid="new-policy-button"`                                                   | testid        | 317                           |
| `data-testid="reminders-empty-state"`                                               | testid        | 350                           |
| `data-testid={`policy-row-${id}`}`                                                  | templated     | 452                           |
| `data-testid={`expand-${id}`}`                                                      | templated     | 486                           |
| `data-testid={`edit-${id}`}`                                                        | templated     | 496                           |
| `data-testid={`remove-${id}`}`                                                      | templated     | 505                           |
| `data-testid="policy-form"`                                                         | testid        | 559                           |
| `aria-label="before or after deadline"`                                             | aria          | 615                           |
| `aria-label="forever (no end date)"`                                                | aria          | 724                           |
| `data-testid="policy-validity-hint"`                                                | testid        | 759                           |
| `data-testid="policy-save-button"`                                                  | testid        | 777                           |
| derived rules panel: `derived-rules-${policyId}`, `derived-rules-empty-${policyId}` | templated     | derived-rules-panel.tsx:30/41 |

### 1.9 `/admin?tab=reopen`

Component uses `<ReopenTabLabel>` (`aria-label={`${count} pending reopen requests`}`). Body content not yet hooked (regression scope — covered indirectly by `/admin` smoke tests).

### 1.10 `/admin?tab=jobs` — `components/admin/jobs-tab.tsx`

| element                            | testId / aria | line |
| ---------------------------------- | ------------- | ---- |
| `data-testid="jobs-tab"`           | testid        | 108  |
| `data-testid="jobs-error-state"`   | testid        | 129  |
| `data-testid="jobs-empty-state"`   | testid        | 140  |
| `data-testid="jobs-table"`         | testid        | 151  |
| `data-testid={`jobs-row-${id}`}`   | templated     | 185  |
| `aria-label={`Retry job ${id}`}`   | templated     | 231  |
| `data-testid="jobs-loading-state"` | testid        | 251  |
| `aria-label="Loading failed jobs"` | aria          | 252  |

### 1.11 `/admin?tab=actions` — `components/admin/action-log-tab.tsx`

| element                                                                  | testId / aria | line           |
| ------------------------------------------------------------------------ | ------------- | -------------- |
| `data-testid="action-log-tab"`                                           | testid        | 93             |
| `aria-label={`Copy reference id ${value}`}`                              | templated     | 229            |
| Search-box wired through `<TabHeader>` (`aria-label` = `Search actions`) | aria          | tab-header.tsx |

### 1.12 `/admin?tab=settings` (5 sub-tabs) — `components/admin/settings-tab.tsx`

| element                                                                          | testId / aria | line         |
| -------------------------------------------------------------------------------- | ------------- | ------------ |
| `aria-label="Save organization identity"`                                        | aria          | 217          |
| `aria-label="Save period settings"`                                              | aria          | 790          |
| `aria-label="Save reminder defaults"`                                            | aria          | 896          |
| `aria-label="Save notification settings"`                                        | aria          | 978          |
| `data-testid="integration-row-telegram"`                                         | testid        | 1039         |
| `data-testid="integration-badge-telegram"`                                       | testid        | 1054/1062    |
| `data-testid="integration-telegram-configured"`                                  | testid        | 1074         |
| `data-testid="integration-telegram-bindings"`                                    | testid        | 1081         |
| Form labels: `Department Name`, `Toggle auto-create periods`, `Default Deadline` | label assoc   | settings-tab |

### 1.13 `/head/dashboard` — `app/(app)/head/dashboard/page.tsx`

| element                                                                                                                                                    | testId / aria     | source                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------- |
| KPI cards: 3 `aria-label`'d cells (`Submissions: …`, `Deadline: …`, `Risks: …`)                                                                            | aria              | kpi-cards.tsx                      |
| `<ProductKpiCard>`: `data-testid="product-kpi-card"` + `aria-label="Product KPIs"` + `aria-label="On-time ratio sparkline over the last 4 periods"`        | testid + aria     | product-kpi-card.tsx:47/64/89/107  |
| `<ActivityLivePanel>`: `aria-labelledby="activity-live-heading"`, `aria-label="Lead section statuses"`, `aria-label={`${lead} has no report content yet`}` | aria + labelledby | activity-live-panel.tsx:40/107/181 |
| `<ReportArchiveSection>`: `aria-label="Load more archived reports"`                                                                                        | aria              | report-archive-section.tsx:136     |
| Heading `Dashboard`                                                                                                                                        | h1                | dashboard/page.tsx                 |
| Heading `Report Archive`                                                                                                                                   | h2                | dashboard                          |

### 1.14 `/head/report` and `/head/report/[reportId]` — assembled weekly view

| element                                                                                                                                                                       | testId / aria | source                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------ |
| `<PeriodNavigator>` weekly variant: `aria-label="Period navigation (swipe…)"`, `aria-label="Previous week"`, `aria-label="Select reporting period"`, `aria-label="Next week"` | aria          | weekly-report/period-navigator.tsx:114-152 |
| `<PublishLockButton>`: `aria-label="Reopen Period"`, `aria-label="Confirm publish"`                                                                                           | aria          | publish-lock-button.tsx:61/116             |
| Heading `Weekly Report`                                                                                                                                                       | h1            | head/report                                |
| Buttons: `Publish & Lock`, `Publish Anyway`, `Toggle All`, `Send Reminder` (text-named)                                                                                       | button text   | weekly-report/\*                           |
| `<WeeklyReportSkeleton>` aria `Loading status report`                                                                                                                         | aria          | weekly-report-skeleton.tsx:43              |

### 1.15 `/lead/report` and `/lead/report/[reportId]` — `components/lead/lead-form.tsx`

| element                                                                                                                          | testId / aria      | source                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------- |
| `data-testid="lead-report-form"` (root form)                                                                                     | testid             | lead-form.tsx:1162                     |
| `aria-label="Confirm submission"` (dialog)                                                                                       | aria               | lead-form.tsx:1432                     |
| `<PeriodNavigator>` lead variant: `Previous period`, `Next period`, `Select reporting period`, plus `Period navigation (swipe…)` | aria               | lead/period-navigator.tsx:123-170      |
| `<VersionHistoryNav>`: `Previous version`, `Next version`, `Save Version`, `Version history`, `Close`, `Show all ${N} versions`  | aria               | version-history-nav.tsx:138-286        |
| `<FillFromButton>`: `Choose past report to fill from`, `Confirm fill from previous`                                              | aria               | fill-from-button.tsx:107/167           |
| `<CurrentWeekSection>`: `Add first current-week item`, `Add item to ${productName}`                                              | aria               | current-week-section.tsx:135/187       |
| `<NextWeekSection>`: `Add first next-week item`, `Add item to ${productName}`                                                    | aria               | next-week-section.tsx:122/172          |
| `<ItemCard>`: `data-testid="item-card"`, `aria-label="Edit"`, `aria-label="Delete"`, `aria-label="Edit item text"`               | testid + aria      | item-card.tsx:103/136/144/185          |
| `<ItemEditDialog>`: `aria-label={`${verb} dialog`}`                                                                              | templated          | item-edit-dialog.tsx:163               |
| `<PrioritiesSection>`: `data-testid="priority-row"`, `Edit priority ${rank}`, `Delete priority ${rank}`                          | testid + templated | priorities-section.tsx:168/186/219/227 |
| `<PriorityEditDialog>`: `aria-label={`${verb} dialog`}`                                                                          | templated          | priority-edit-dialog.tsx:100           |
| `<RisksSection>`: `Edit risk for ${product}`, `Delete risk for ${product}`                                                       | templated          | risks-section.tsx:166/174              |
| `<RiskEditDialog>`: `aria-label={`${verb} dialog`}`                                                                              | templated          | risk-edit-dialog.tsx:144               |
| `<DecisionsSection>`: `Edit decision`, `Delete decision for ${product}`                                                          | templated          | decisions-section.tsx:180/188          |
| `<DecisionEditDialog>`: `aria-label={`${verb} dialog`}`                                                                          | templated          | decision-edit-dialog.tsx:115           |
| `<RequestReopenDialog>`: `aria-label="Request Reopen dialog"`                                                                    | aria               | request-reopen-dialog.tsx:88           |
| `<ConfirmDeleteDialog>`: `aria-labelledby="confirm-delete-title"`                                                                | labelledby         | confirm-delete-dialog.tsx:112          |
| `<StageChip>`: `aria-label={`${stage}: ${status}`}`, `aria-label={`Set status for ${stage}`}`                                    | templated          | stage-chip.tsx:183/222                 |
| `<LeadFormSkeleton>`: `aria-label="Loading report form"`                                                                         | aria               | lead-form-skeleton.tsx:40              |
| Submit button `Submit Report` (text)                                                                                             | button text        | lead-form.tsx                          |
| Form fields: `Decision`, `Risk`, `Description`, `Owner`, `Product`, `Mitigation`, `Impact`, `Deadline / Due`                     | label assoc        | edit dialogs                           |

### 1.16 `/lead/history` — `components/lead/lead-history-sidebar.tsx`

| element                                                 | testId / aria | source                       |
| ------------------------------------------------------- | ------------- | ---------------------------- |
| `<aside aria-label="Reporting overview">`               | aria          | 39                           |
| `<LeadHistorySkeleton>`: `aria-label="Loading history"` | aria          | lead-history-skeleton.tsx:20 |
| Heading `My History`                                    | h1            | history/page.tsx             |

### 1.17 `/reports?tab=drafts|published` — `app/(app)/reports/page.tsx`

| element                                    | testId / aria | source               |
| ------------------------------------------ | ------------- | -------------------- |
| `aria-label={`Show all ${N} submissions`}` | templated     | reports/page.tsx:205 |
| Heading `Отчёты` / `Report Archive`        | h1            | reports              |

### 1.18 `/reports/[reportId]` — `app/(app)/reports/[reportId]/page.tsx`

| element                          | testId / aria | source |
| -------------------------------- | ------------- | ------ |
| `aria-label="Back to Dashboard"` | aria          | 44     |
| `aria-label="Export PDF"`        | aria          | 54     |

### 1.19 `/reports/trends` — `app/(app)/reports/trends/page.tsx`

| element                                                                                                           | type       | source    |
| ----------------------------------------------------------------------------------------------------------------- | ---------- | --------- |
| Three sections via `aria-labelledby` (trends-history-heading, trends-velocity-heading, trends-comparison-heading) | labelledby | 79/90/101 |

### 1.20 `/reports/history`

No explicit hooks; reuses `<ReportArchiveSection>` and `<NavBar>`.

### 1.21 `/print/[reportId]` — server-rendered, no interactive hooks. Used by PDF pipeline

### 1.22 Cross-cutting: navigation & dev tools

| element                                                                                                                                                                                                                                                                              | testId / aria | source                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------- |
| `<NavBar>`: `data-testid="nav-bar"`, `aria-label="Main navigation"`, `aria-label="Mobile navigation"`, `aria-label="Open navigation menu"`, `aria-label={`${orgShortName} home`}`, `data-testid="nav-logout"`, `aria-label="Sign out"`, `aria-label={`${user.name} (${roleLabel})`}` | testid + aria | nav-bar.tsx:229/238/254/308/327/328/388/412 |
| `<DevRoleSwitcher>`: `dev-role-switcher-trigger`, `dev-role-switcher-${role}-${email}` (templated), `dev-role-switcher-reseed-min/full`, `dev-role-switcher-wipe-manual-uat`, `dev-role-switcher-logout`                                                                             | testid        | role-switcher.tsx:110-178                   |
| `<AiSummaryCard>`: `aria-label={`Tone: ${tone}`}`, `aria-label="Regenerate summary"`, `aria-label="Dismiss summary"`                                                                                                                                                                 | aria          | ai-summary-card.tsx:76/91/100               |
| `<PeriodSummaryTabs>`: `data-testid="ai-summary-text"`, `aria-label="Mock summary stub"`                                                                                                                                                                                             | testid + aria | period-summary-tabs.tsx:74/91/98            |
| `<RiskSentimentBadge>`: `aria-label={`AI sentiment: ${level}`}`                                                                                                                                                                                                                      | templated     | risk-sentiment-badge.tsx:38                 |
| `<OnTrackIcon>`: `aria-label={`On-track / Attention / Off-track (${tooltip})`}`                                                                                                                                                                                                      | templated     | on-track-icon.tsx:38/49/59                  |
| `<SdlcTooltip>`: `data-testid="sdlc-tooltip"`                                                                                                                                                                                                                                        | testid        | sdlc-tooltip.tsx:80                         |
| `<ConfirmationDialog>`: `aria-label={title}`                                                                                                                                                                                                                                         | templated     | confirmation-dialog.tsx:99                  |
| `<SearchInput>`: `aria-label={badge.aria}` (per-badge)                                                                                                                                                                                                                               | templated     | search-input.tsx:258                        |
| `<DlqBadge>`: `aria-label={`Email-reminder DLQ count: ${count}`}`                                                                                                                                                                                                                    | templated     | dlq-badge.tsx:29                            |
| `<ReopenTabLabel>`: `aria-label={`${count} pending reopen requests`}`                                                                                                                                                                                                                | templated     | reopen-tab-label.tsx:38                     |

---

## 2. Playwright spec inventory

Per-spec — abridged form, full extraction stored in `/tmp/spec_coverage.txt` (re-generate with `bash`-grep). Spec count: 38 (top-level + regression + integration + a11y + visual + responsive).

```
top-level (apps/web/e2e/*.spec.ts) — 20
regression (apps/web/e2e/regression/*.spec.ts) — 13
integration (apps/web/e2e/integration/*.spec.ts) — 8
a11y/responsive/visual — 7
```

Most heavily-exercised hooks (count of spec files that reference each):

| hook                                              | spec count |
| ------------------------------------------------- | ---------- |
| `getByRole('heading', { name: 'Weekly Report' })` | 6          |
| `getByRole('button', { name: 'Submit Report' })`  | 6          |
| `getByRole('button', { name: 'Publish & Lock' })` | 4          |
| `data-testid="lead-report-form"`                  | 4          |
| `data-testid="admin-panel"`                       | 3          |
| `data-testid="products-table"`                    | 3          |
| `getByLabel("Users tab")`                         | 4          |

Per-spec asserted-element table is too long for inline; see `/tmp/spec_coverage.txt` snapshot from generation pass. Below is a digest of the most coverage-bearing specs:

| spec                                 | covers                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `weekly-report.spec.ts`              | period nav (prev/next/select week), publish lock confirm, Cancel/Publish Anyway |
| `weekly-report-advanced.spec.ts`     | Toggle All, publish flow variants                                               |
| `cross-role-lifecycle.spec.ts`       | full lead → head publish flow                                                   |
| `lead-form-crud.spec.ts`             | Add/Edit/Delete priority + risk + decision, dialog labels, all form fields      |
| `lead-form-states.spec.ts`           | stage-chip status (on-track / at-risk / blocked / clear), submit, cancel        |
| `lead-journey.spec.ts`               | period switching, submit                                                        |
| `period-features.spec.ts`            | fill-from-previous, version-history-nav (incl. Close/Restore)                   |
| `publish-revoke.spec.ts`             | Export PDF, Publish & Lock, Publish Anyway (Reopen marked `fixme`)              |
| `admin-panel.spec.ts`                | settings form (Department Name, Default Deadline, auto-create toggle)           |
| `admin-advanced.spec.ts`             | create period, edit/delete user, expand stage assignments                       |
| `url-routing.spec.ts`                | tab navigation (Users, Periods, Products, Reminders, Settings)                  |
| `dashboard-advanced.spec.ts`         | pagination (Page 1-3, Next/Previous page)                                       |
| `head-dashboard.spec.ts`             | Deadline label, Send Reminder, headings                                         |
| `error-paths.spec.ts`                | Return to login, Users tab navigation, auth error                               |
| `lead-history.spec.ts`               | history heading only                                                            |
| `login-stub.spec.ts`                 | SSO sign-in CTA                                                                 |
| `pdf-export.spec.ts`                 | Core Development / Portfolio headings (PDF render only)                       |
| `regression/agent-b-*`               | testid-driven smoke for lead form sub-areas + admin tabs                        |
| `integration/admin-crud.integration` | CRUD with DB seed                                                               |
| `a11y/accessibility.spec.ts`         | generic getByRole audit                                                         |
| `visual/*.spec.ts`                   | golden-image snapshots; assert headings only                                    |

---

## 3. Coverage matrix

Long form — split by route. Status legend: `✓` covered (literal or regex match in spec); `~` partial (covered indirectly by container assertion but not interacted with); `✗` uncovered.

### 3.1 Admin matrix

| route / tab          | element                                                                                                             | covered by                                                                                                   | status                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| /admin (shell)       | `data-testid="admin-panel"`                                                                                         | regression/agent-b-admin-products.spec.ts, agent-b-admin-users, agent-b-admin-jobs, admin-stage-reassignment | ✓                                                                                          |
| /admin (shell)       | `aria-label="Admin tabs"` (nav)                                                                                     | —                                                                                                            | ✗                                                                                          |
| /admin (shell)       | per-tab `${LABEL} tab` aria                                                                                         | url-routing.spec.ts (Users/Periods/Products/Reminders/Settings), error-paths (Users tab), edge-cases         | ✓ for 5 / ✗ for `Reopen tab`, `Jobs tab` directly (jobs covered via testId), `Actions tab` |
| /admin (shell)       | `aria-label="Admin tab"` (mobile select)                                                                            | —                                                                                                            | ✗                                                                                          |
| /admin?tab=users     | `data-testid="users-table"`                                                                                         | phase16-17-uat, admin-groups, agent-b-admin-users                                                            | ✓                                                                                          |
| /admin?tab=users     | `aria-label="Add new user"`                                                                                         | —                                                                                                            | ✗                                                                                          |
| /admin?tab=users     | `aria-label="Edit ${name}"`, `Delete ${name}`                                                                       | admin-advanced.spec.ts (Maria/Alexey)                                                                        | ✓                                                                                          |
| /admin?tab=users     | `data-testid="crud-sheet"`                                                                                          | —                                                                                                            | ✗                                                                                          |
| /admin?tab=users     | `aria-label="Edit user" / "Add user"` (sheet)                                                                       | —                                                                                                            | ✗                                                                                          |
| /admin?tab=users     | `aria-label="Confirm delete"`                                                                                       | —                                                                                                            | ✗                                                                                          |
| /admin?tab=users     | form fields Name/Email/Role/Group                                                                                   | agent-b-admin-users                                                                                          | ✓                                                                                          |
| /admin?tab=groups    | `data-testid="groups-tab"`                                                                                          | admin-groups.spec.ts                                                                                         | ✓                                                                                          |
| /admin?tab=groups    | `data-testid="groups-table"`                                                                                        | admin-groups                                                                                                 | ✓                                                                                          |
| /admin?tab=groups    | `aria-label="Add group"`                                                                                            | —                                                                                                            | ✗                                                                                          |
| /admin?tab=groups    | `aria-label="Edit ${group}"`, `Archive ${group}`                                                                    | —                                                                                                            | ✗                                                                                          |
| /admin?tab=groups    | `aria-label="Edit group"/"Add group"` sheet                                                                         | —                                                                                                            | ✗                                                                                          |
| /admin?tab=groups    | `aria-label="Confirm archive"`                                                                                      | —                                                                                                            | ✗                                                                                          |
| /admin?tab=groups    | group-products-editor + chips                                                                                       | —                                                                                                            | ✗                                                                                          |
| /admin?tab=products  | `data-testid="products-table"`                                                                                      | agent-b-admin-products, admin-stage-reassignment, product-ready-progressive                                  | ✓                                                                                          |
| /admin?tab=products  | `aria-label="Add new product"`                                                                                      | agent-b-admin-products (`Add Product` button text)                                                           | ✓                                                                                          |
| /admin?tab=products  | `aria-label="Edit ${name}"`, `Archive ${name}`, `Restore ${name}`                                                   | agent-b-admin-products (`Restore`)                                                                           | ~ (restore only)                                                                           |
| /admin?tab=products  | `aria-label="Expand stage assignments for ${name}"`                                                                 | admin-stage-reassignment (CRM Portal)                                                                        | ✓                                                                                          |
| /admin?tab=products  | `aria-label="Assign ${stage} stage for ${project}"`                                                                 | —                                                                                                            | ✗                                                                                          |
| /admin?tab=products  | `aria-label="Edit product"/"Add product"` dialog                                                                    | agent-b-admin-products (`Add product`)                                                                       | ✓                                                                                          |
| /admin?tab=products  | `product-group-chips*` testids + aria                                                                               | —                                                                                                            | ✗                                                                                          |
| /admin?tab=periods   | `periods-active-loading`, `-active-empty`, `-archive-toggle`, `-archive-body`, `-archive-loading`, `-archive-empty` | —                                                                                                            | ✗                                                                                          |
| /admin?tab=periods   | templated row testids, state-badge, progress                                                                        | —                                                                                                            | ✗                                                                                          |
| /admin?tab=periods   | action-menu trigger + items, `aria-label="Actions for period ${id}"`                                                | —                                                                                                            | ✗                                                                                          |
| /admin?tab=periods   | `aria-label="Create new period"`                                                                                    | admin-advanced.spec.ts                                                                                       | ✓                                                                                          |
| /admin?tab=reminders | `data-testid="new-policy-button"`                                                                                   | —                                                                                                            | ✗                                                                                          |
| /admin?tab=reminders | `data-testid="reminders-empty-state"`                                                                               | —                                                                                                            | ✗                                                                                          |
| /admin?tab=reminders | row testids + expand/edit/remove                                                                                    | —                                                                                                            | ✗                                                                                          |
| /admin?tab=reminders | `data-testid="policy-form"`, `policy-save-button`, `policy-validity-hint`                                           | —                                                                                                            | ✗                                                                                          |
| /admin?tab=reminders | `aria-label="before or after deadline"`, `aria-label="forever (no end date)"`                                       | —                                                                                                            | ✗                                                                                          |
| /admin?tab=reminders | derived-rules-panel testids                                                                                         | —                                                                                                            | ✗                                                                                          |
| /admin?tab=jobs      | `data-testid="jobs-tab"`, `jobs-table`, `jobs-loading-state`, `jobs-empty-state`, `jobs-error-state`                | agent-b-admin-jobs, product-ready-progressive                                                                | ✓                                                                                          |
| /admin?tab=jobs      | `aria-label="Loading failed jobs"`                                                                                  | —                                                                                                            | ~ (covered via testid)                                                                     |
| /admin?tab=jobs      | `aria-label="Retry job ${id}"`                                                                                      | agent-b-admin-jobs (`Retry/Повтор`)                                                                          | ✓                                                                                          |
| /admin?tab=jobs      | templated row testid                                                                                                | —                                                                                                            | ✗                                                                                          |
| /admin?tab=actions   | `data-testid="action-log-tab"`                                                                                      | admin-groups, admin-stage-reassignment                                                                       | ✓                                                                                          |
| /admin?tab=actions   | `aria-label="Search actions"`                                                                                       | admin-groups, admin-stage-reassignment                                                                       | ✓                                                                                          |
| /admin?tab=actions   | `aria-label="Copy reference id ${value}"`                                                                           | —                                                                                                            | ✗                                                                                          |
| /admin?tab=settings  | `Department Name`, `Default Deadline`, `Toggle auto-create periods`                                                 | admin-panel.spec.ts, url-routing                                                                             | ✓                                                                                          |
| /admin?tab=settings  | `aria-label="Save organization identity"`                                                                           | —                                                                                                            | ✗                                                                                          |
| /admin?tab=settings  | `aria-label="Save period settings"`                                                                                 | —                                                                                                            | ✗                                                                                          |
| /admin?tab=settings  | `aria-label="Save reminder defaults"`                                                                               | —                                                                                                            | ✗                                                                                          |
| /admin?tab=settings  | `aria-label="Save notification settings"`                                                                           | —                                                                                                            | ✗                                                                                          |
| /admin?tab=settings  | `integration-row-telegram` + badges + configured + bindings                                                         | —                                                                                                            | ✗                                                                                          |
| /admin?tab=reopen    | (body content)                                                                                                      | —                                                                                                            | ✗ (component not yet hooked, low risk)                                                     |

### 3.2 Lead matrix (/lead/report)

| element                                                                                  | covered by                                                       | status                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| `data-testid="lead-report-form"`                                                         | regression/agent-b-\* (4 specs)                                  | ✓                                           |
| Period nav: Previous/Next/Select period                                                  | lead-journey, period-features                                    | ✓                                           |
| `aria-label="Period navigation (swipe…)"`                                                | —                                                                | ✗ (decorative wrapper)                      |
| Version history: Prev/Next/Save/Version history/Close                                    | period-features                                                  | ✓                                           |
| Fill-from-previous: Choose past / Confirm fill                                           | period-features                                                  | ✓                                           |
| `<CurrentWeekSection>`: Add first current-week item                                      | integration/lead-form-mobile, lead-journey regex                 | ✓                                           |
| `<NextWeekSection>`: Add first next-week item                                            | —                                                                | ✗                                           |
| per-product `Add item to ${product}`                                                     | integration/lead-form-mobile (regex)                             | ~                                           |
| `<ItemCard>` testid + Edit/Delete/Edit-item-text aria                                    | agent-b-lead-items (testid + Edit button via regex)              | ~ (text label "Edit item text" not covered) |
| Item dialog (`${verb} dialog`)                                                           | lead-journey integration                                         | ✓                                           |
| Priorities: `data-testid="priority-row"`, Edit priority ${rank}, Delete priority ${rank} | agent-b, agent-b-lead-priorities, lead-form-crud                 | ✓                                           |
| PriorityEditDialog                                                                       | lead-form-crud                                                   | ✓                                           |
| Risks: Edit/Delete risk for ${product}                                                   | lead-form-crud, lead-form-states (Cloud/CRM), agent-b-lead-risks | ✓                                           |
| RiskEditDialog                                                                           | lead-form-crud                                                   | ✓                                           |
| Decisions: Edit decision, Delete decision for ${product}                                 | lead-form-crud, lead-form-states                                 | ✓                                           |
| DecisionEditDialog                                                                       | lead-form-crud                                                   | ✓                                           |
| `aria-label="Request Reopen dialog"`                                                     | —                                                                | ✗                                           |
| `aria-label="Confirm submission"`                                                        | —                                                                | ✗                                           |
| ConfirmDeleteDialog labelledby                                                           | lead-form-crud (Delete priority/risk regex)                      | ~                                           |
| `<StageChip>` per-product labels + `Set status for…`                                     | lead-form-states (Dev/Planning/Testing/DevOps), a11y-advanced    | ✓                                           |
| Submit Report (button text)                                                              | many                                                             | ✓                                           |
| Form labels: Decision/Risk/Description/Owner/Product/Mitigation/Impact/Deadline          | lead-form-crud                                                   | ✓                                           |
| LeadFormSkeleton aria                                                                    | —                                                                | ✗                                           |

### 3.3 Head matrix (/head/dashboard, /head/report)

| element                                                                                                                 | covered by                                                                                                                  | status                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Heading `Dashboard`                                                                                                     | data-integrity, cross-role-lifecycle, a11y-advanced, edge-cases, head-dashboard, responsive/breakpoints, a11y/accessibility | ✓                                                                                                                     |
| KPI card `aria-label="Submissions…"`                                                                                    | —                                                                                                                           | ✗                                                                                                                     |
| KPI card `aria-label="Deadline: ${label}, ${time}"`                                                                     | head-dashboard regex `Deadline:`                                                                                            | ✓                                                                                                                     |
| KPI card `aria-label="Risks: …"`                                                                                        | —                                                                                                                           | ✗                                                                                                                     |
| `<ProductKpiCard>` testid `product-kpi-card` + Product KPIs aria + sparkline aria                                       | —                                                                                                                           | ✗                                                                                                                     |
| Activity panel: `aria-labelledby="activity-live-heading"`, `Lead section statuses`, `${lead} has no report content yet` | —                                                                                                                           | ✗ (skeleton/activity-live ts uses `data-testid="activity-live-relative-time"` referenced in dashboard spec — partial) |
| `<ReportArchiveSection>`: `Load more archived reports`                                                                  | —                                                                                                                           | ✗                                                                                                                     |
| `<PeriodNavigator>` weekly: Previous/Next/Select week                                                                   | weekly-report                                                                                                               | ✓                                                                                                                     |
| Publish-lock: Publish & Lock, Publish Anyway, Cancel                                                                    | weekly-report, weekly-report-advanced, cross-role-lifecycle, publish-revoke                                                 | ✓                                                                                                                     |
| `aria-label="Reopen Period"`                                                                                            | —                                                                                                                           | ✗ (fixme'd in publish-revoke)                                                                                         |
| `aria-label="Confirm publish"`                                                                                          | —                                                                                                                           | ✗                                                                                                                     |
| `Toggle All`                                                                                                            | weekly-report-advanced                                                                                                      | ✓                                                                                                                     |
| `Send Reminder`                                                                                                         | head-dashboard                                                                                                              | ✓                                                                                                                     |
| `Export PDF` (button)                                                                                                   | publish-revoke                                                                                                              | ✓                                                                                                                     |
| Heading `Report Archive`                                                                                                | head-dashboard                                                                                                              | ✓                                                                                                                     |
| `<WeeklyReportSkeleton>` aria                                                                                           | —                                                                                                                           | ✗                                                                                                                     |

### 3.4 Reports / shared

| element                                                 | covered by                             | status                                   |
| ------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| Heading `Отчёты` / `Report Archive`                     | visual/reports.spec.ts, head-dashboard | ✓                                        |
| `aria-label="Show all ${N} submissions"` (reports/page) | —                                      | ✗                                        |
| `/reports/[reportId]` `Back to Dashboard`               | —                                      | ✗                                        |
| `/reports/[reportId]` `Export PDF` (link aria)          | —                                      | ✗ (distinct from head Export PDF button) |
| `/reports/trends` three section labelledby              | —                                      | ✗                                        |
| `/print/[reportId]`                                     | pdf-export.spec.ts (heading-only)      | ~                                        |

### 3.5 Cross-cutting

| element                                                      | covered by                                    | status                                                     |
| ------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| `<NavBar>` `data-testid="nav-bar"`                           | phase16-17-uat                                | ✓                                                          |
| `aria-label="Main navigation"`                               | —                                             | ✗                                                          |
| `aria-label="Mobile navigation"`                             | —                                             | ✗                                                          |
| `aria-label="Open navigation menu"`                          | —                                             | ✗                                                          |
| `aria-label={`${org} home`}` (logo home link)                | —                                             | ✗                                                          |
| `data-testid="nav-logout"` + `aria-label="Sign out"`         | —                                             | ✗ (auth setup uses /api/auth/dev-login, not the UI logout) |
| `<DevRoleSwitcher>` testids (5)                              | —                                             | ✗ (dev-only, not on critical path)                         |
| `<AiSummaryCard>` 3 aria                                     | —                                             | ✗                                                          |
| `<PeriodSummaryTabs>` `ai-summary-text`, `Mock summary stub` | —                                             | ✗                                                          |
| `<RiskSentimentBadge>` aria                                  | —                                             | ✗                                                          |
| `<OnTrackIcon>` aria (3 variants)                            | —                                             | ✗                                                          |
| `<SdlcTooltip>` testid                                       | —                                             | ✗                                                          |
| `<ConfirmationDialog>` aria                                  | indirectly via lead-form-crud delete confirms | ~                                                          |
| `<DlqBadge>` aria                                            | —                                             | ✗                                                          |
| `<ReopenTabLabel>` aria                                      | —                                             | ✗                                                          |
| `<LeadHistorySidebar>` `aria-label="Reporting overview"`     | —                                             | ✗                                                          |
| `<LeadHistorySkeleton>` aria                                 | —                                             | ✗                                                          |
| Landing `aria-label="Your PULSE"`                            | —                                             | ✗                                                          |
| Heading `CustomReport`                                       | regression/agent-a-landing                    | ✓                                                          |
| Heading `Core Development`                                 | pdf-export                                    | ✓                                                          |
| Heading `Portfolio Overview`                                 | pdf-export                                    | ✓                                                          |

---

## 4. Uncovered elements — priority queue

▲ **Critical (forms / state-changing buttons)**

1. `aria-label="Confirm submission"` (lead-form submit confirm dialog) — gates publication; never asserted.
2. `aria-label="Confirm publish"` (head publish-lock confirm) — only triggered by text-button; the aria-confirm step is uncovered.
3. `aria-label="Reopen Period"` (publish-revoke flow) — explicitly `fixme`'d in `publish-revoke.spec.ts`; SC-156 marked open.
4. `aria-label="Confirm archive"` (groups), `Confirm delete` (users) — destructive paths, no assertion.
5. `aria-label="Add new product"`, `Add new user`, `Add group` — primary CRUD CTAs; only product is reached via button-text fallback.
6. `policy-form`, `policy-save-button`, `new-policy-button`, `policy-validity-hint`, `reminders-empty-state` — entire `/admin?tab=reminders` form & list flow is uncovered.
7. `Save organization identity`, `Save period settings`, `Save reminder defaults`, `Save notification settings` — settings persistence asserted nowhere; spec navigates the form but never asserts the save aria label.
8. `aria-label="Request Reopen dialog"` (lead-side reopen request) — counterpart to (3).
9. `periods-active-empty / -archive-toggle / -archive-body / state-badge-* / action-menu-*` — entire periods table data layer including row state lifecycle.
10. `integration-row-telegram` + badges + bindings — Phase-46 admin integration tab.
11. `aria-label="Save Version"` (version-history-nav) — saves are exercised through Restore but the Save aria not.
12. `group-products-editor / -loading / -list` + `Toggle ${product}` — group↔product M:N binding UI.
13. `product-group-chips*` — read-side counterpart to (12) on products tab.
14. `derived-rules-${policyId}` (reminders) — derived-rules visibility.
15. NavBar logout: `data-testid="nav-logout"` + `aria-label="Sign out"` — auth happens via dev-login API only.

▼ **Medium (state read / KPIs / dashboards)**

1. `aria-label="Submissions: …"`, `aria-label="Risks: …"` (KPI cards 2 of 3).
2. `<ProductKpiCard>` cluster (`product-kpi-card`, `Product KPIs`, sparkline aria).
3. `<ActivityLivePanel>`: `activity-live-heading`, `Lead section statuses`, `${lead} has no report content yet`.
4. `Load more archived reports` (head dashboard archive paginator).
5. `Show all ${N} submissions` (reports/page list).
6. `/reports/[reportId]`: `Back to Dashboard`, `Export PDF` (the reports route counterpart — distinct from head publish button).
7. `/reports/trends` three sections aria-labelledby.
8. `<AiSummaryCard>`: `Regenerate summary`, `Dismiss summary`, tone aria.
9. `<PeriodSummaryTabs>` `ai-summary-text` + `Mock summary stub`.
10. `aria-label="Open navigation menu"` + Mobile navigation panel.
11. `aria-label="Period navigation (swipe…)"` (both lead and head variants — only inner buttons asserted).
12. `<RiskSentimentBadge>`, `<OnTrackIcon>` aria variants — purely visual but documented hooks.
13. `<DlqBadge>` and `<ReopenTabLabel>` count aria — observability badges.

▽ **Low (loading / decorative)**

1. All five `Loading …` arias (`Loading failed jobs`, `Loading history`, `Loading report form`, `Loading status report`, `Loading failed jobs`) — covered indirectly by waitFor of the loaded state.
2. `aria-label="Your PULSE"` (landing logo).
3. `Mock summary stub` badge.
4. `aria-label="Reporting overview"` (history sidebar wrapper).
5. `aria-label="Copy reference id ${value}"` (action-log row copy button).
6. `<DevRoleSwitcher>` 5 testids — dev-only switcher; intentionally out of regression set.

---

## 5. Proposed test scenarios (top-10)

Concise per-scenario sketch — naming follows `page-section-element-action`:

1. **admin-reminders-policy-form-create**: open `/admin?tab=reminders` → click `new-policy-button` → assert `policy-form` visible → fill name + offset + radio `before or after deadline` → expect `policy-validity-hint` text "Valid" → click `policy-save-button` → row `policy-row-<id>` appears.
2. **admin-periods-archive-row-action-menu**: open `/admin?tab=periods` → click `periods-archive-toggle` → expect `periods-archive-body` visible → click first `action-menu-trigger-<id>` → `action-menu-<id>` opens → click `Archive` item → row removes from active table, `state-badge-archived` appears in archive table.
3. **head-publish-lock-confirm**: head on `/head/report` → click `Publish & Lock` → confirm dialog renders with `aria-label="Confirm publish"` → press `Enter` → period transitions to `published` and `aria-label="Reopen Period"` button appears.
4. **head-reopen-period** (currently `fixme`): from published state, click `Reopen Period` → confirmation `Confirm publish` dialog (reused?) or new `Confirm reopen` dialog → state returns to `published-but-editable` → lead form unlocks.
5. **lead-submit-confirm**: lead on `/lead/report` → fill required → `Submit Report` → confirm dialog with `aria-label="Confirm submission"` → click `Submit` → report becomes `submitted`, badge updates, period nav next-step available.
6. **lead-request-reopen**: after submit, click reopen-request button → `aria-label="Request Reopen dialog"` opens → fill reason → submit → assert API queues reopen-request and disabled state in `<RequestReopenDialog>`.
7. **admin-settings-save-organization**: in `/admin?tab=settings` sub-tab "Identity" → edit `Department Name` → click button with `aria-label="Save organization identity"` → toast `Saved` and reloaded value matches.
8. **admin-products-group-chips-render**: open product detail → assert `product-group-chips` list visible with at-least-one chip per assigned group; loading then empty states (`product-group-chips-loading`, `product-group-chips-empty`) reachable via fresh fixture.
9. **admin-groups-products-editor-toggle**: open group sheet → wait for `group-products-editor` → `group-products-list` visible → click `aria-label="Toggle ${product}"` for one product → save group → re-open and confirm product is included.
10. **head-dashboard-product-kpi-card**: navigate `/head/dashboard` → assert ≥1 `product-kpi-card` rendered with both `Product KPIs` and `On-time ratio sparkline over the last 4 periods` aria — guarantees Phase-44 dashboard remains wired.

---

## 6. Tooling recommendations

1. **ESLint rule** — adopt or fork `eslint-plugin-jsx-a11y` plus a custom rule
   `require-testid-on-interactive` enforcing `data-testid` on any
   `<button>|<a href>|<input>|<select>|<textarea>|[role]` that is not
   purely decorative. Phase-in via `severity: warn` then `error` once
   coverage reaches 80 %.
2. **Naming convention** — adopt `page-section-element-action`, e.g.
   `admin-periods-archive-toggle`, `lead-priority-row`, `head-publish-confirm`.
   Codify in `apps/web/docs/test-ids.md` and link from `CLAUDE.md`.
3. **Playwright codegen as preflight** — every new tab/dialog must ship
   with at least one codegen-derived smoke spec (1 happy path).
4. **DOM snapshot diff in CI** — capture `data-testid` & `aria-label`
   set per route on every PR; diff against `apps/web/e2e/.testid-baseline.json`.
   New testids must be referenced from at least one spec within 7 days, or
   CI fails. Removed testids must be either matched by spec removal or
   migration note.
5. **Templated-key registry** — keep a single source-of-truth file
   (`apps/web/src/lib/test-ids.ts`) exporting frozen literal-template
   helpers (`leadItemCard(id)`, `periodRow(id)`, `actionMenu(id)`).
   Specs import the same helpers; lint forbids hand-typed templates in
   specs.
6. **Accessibility audit on every PR** — extend `a11y/accessibility.spec.ts`
   to crawl every route, run `axe-core`, and gate on any aria-label
   violation. This catches removed hooks even when no spec mentioned
   them by name.
7. **Coverage delta in PR template** — produce `MATRIX.md` regeneration
   in CI; include `coverage_percent` delta line in the PR body and block
   merges that drop coverage by ≥5 %.
8. **Vitest component coverage** — for purely-presentational components
   (`<StageChip>`, `<OnTrackIcon>`, `<RiskSentimentBadge>`, `<DlqBadge>`)
   add `@testing-library/react` assertions in their own `*.test.tsx`;
   these don't need full e2e. ~10 hooks can be retired from the e2e
   pressure this way.
9. **Stop adding aria-labels that no spec consumes** — gate via a CI step
   that diffs the union of `aria-label="..."` literals in `src/` against
   the union of literal strings in `e2e/` and fails build if delta > 5.
10. **Decommission decorative hooks** — `<DevRoleSwitcher>` testids should
    be gated behind `NODE_ENV !== 'production'` AND excluded from the
    coverage matrix so they don't inflate the denominator.

---

## Appendix: regeneration commands

```bash
# DOM inventory (src side)
grep -rhE 'data-testid=' apps/web/src --include='*.tsx' \
  | grep -oE 'data-testid="[^"]+"' | sort -u
grep -rhE 'aria-label="[^"]+"' apps/web/src --include='*.tsx' \
  | grep -oE 'aria-label="[^"]+"' | sort -u

# e2e coverage (literal strings used as selectors)
grep -rhoE "'[^']+'|\"[^\"]+\"" apps/web/e2e \
  --include='*.spec.ts' --include='*.ts' \
  | tr -d "'\"" | sort -u

# per-spec coverage signatures
for f in $(find apps/web/e2e -name '*.spec.ts'); do
  echo "=== $f ==="
  grep -oE "getByTestId\([^)]+\)|getByRole\('[a-z]+'(, *\{[^}]*\})?\)|getByLabel\([^)]+\)|data-testid=\"[^\"]+\"" "$f" \
    | sort -u
done
```
