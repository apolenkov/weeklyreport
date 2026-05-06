---
phase: 39
phase_name: "performance"
reviewed_at: "2026-05-06T23:43:52+03:00"
depth: "standard"
status: "findings_resolved"
files_reviewed: 24
finding_counts:
  critical: 0
  warning: 2
  info: 1
  total: 3
---

# Code Review: Phase 39 Performance

## Scope

Reviewed the implementation files declared by `39-01-PLAN.md` through
`39-05-PLAN.md`, including PgBouncer compose wiring, pg_stat_statements/index
changes, the k6 baseline, full-text search backend/frontend code, and search
tests.

## Findings

### WR-001 - k6 baseline would measure request-shape errors, not performance

**Severity:** Warning  
**Status:** Resolved in current working tree  
**Files:** `tests/load/k6-baseline.js`, `.planning/LOAD-TEST-2026-05.md`

The load-test script used non-canonical tRPC request encoding, called
`weeklyReport.get` with `reportId: null` even though the Zod input accepts an
optional UUID but not null, and posted a `reports.saveDraft` payload shaped as
`patches[]`, which does not match `draftSaveSchema`. A smoke run would inflate
`cr_trpc_errors` with 400 responses and make the baseline unusable.

Resolution: the script now sends tRPC v11 `batch=1` request bodies, decodes the
superjson response wrapper, builds a `draftSaveSchema` payload from the live
`reports.getActive` section, and calls `weeklyReport.get` with `{}`. The load
test methodology doc was updated to match.

**Evidence:** `tests/load/k6-baseline.js:81`, `tests/load/k6-baseline.js:126`,
`tests/load/k6-baseline.js:200`, `.planning/LOAD-TEST-2026-05.md`

### WR-002 - Search UI exposed authorized-only scope to viewer sessions

**Severity:** Warning  
**Status:** Resolved in current working tree  
**Files:** `apps/web/src/app/(app)/reports/page.tsx`,
`apps/web/src/app/(app)/admin/page.tsx`,
`apps/web/src/components/admin/admin-panel.tsx`,
`apps/web/src/components/admin/products-tab.tsx`

`ReportsPage` mounted `<SearchInput scope="all" />` for every non-lead role.
The backend intentionally rejects `scope="all"` unless the role is head/admin,
so viewer sessions would hit FORBIDDEN from a visible search box. Project search
hits also routed to `/admin?tab=products&filter=<projectId>`, but the Products
tab did not consume `filter`, so the click-through did not focus the matched
project.

Resolution: reports search now renders only for lead/head/admin roles, and the
admin products route threads `filter` into `ProductsTab`, filters the list,
expands the matched project, and provides a reset link.

**Evidence:** `apps/web/src/app/(app)/reports/page.tsx:42`,
`apps/web/src/app/(app)/admin/page.tsx:27`,
`apps/web/src/components/admin/products-tab.tsx:47`,
`apps/web/src/components/admin/products-tab.tsx:153`

### IN-001 - Search combobox had no visible error state and weak active-option wiring

**Severity:** Info  
**Status:** Resolved in current working tree  
**File:** `apps/web/src/components/search/search-input.tsx`

The search component ignored query errors, used static input/listbox ids, and
did not expose `aria-activedescendant`. This was not a data leak, but it made
FORBIDDEN or network failures look like empty/no-op UI and weakened screen
reader navigation.

Resolution: the component now uses per-instance ids from `useId`, wires
`aria-activedescendant`, shows a Russian error state, and localizes the result
badges. Component coverage now includes the error state.

**Evidence:** `apps/web/src/components/search/search-input.tsx:107`,
`apps/web/src/components/search/search-input.tsx:118`,
`apps/web/src/components/search/search-input.tsx:168`,
`apps/web/src/components/search/search-input.test.tsx`

## Verification

- `pnpm --filter @customreport/web test src/components/search/search-input.test.tsx` - 10 tests passed
- `pnpm -C apps/web lint` - passed
- `node --check tests/load/k6-baseline.js` - passed

## Residual Risk

The k6 script still needs a real smoke run against a live dev/prod-like stack
with k6 installed. Static syntax and schema-shape review are complete, but
latency and `cr_trpc_errors` cannot be validated without the running stack.
