## Context

Canonical `WeeklyPortfolioProduct` and `WeeklyProductReport` types already describe `mapWeeklyReport` output, but live report/print components import parallel `PortfolioProduct` and `ProductReport` declarations from `dashboard-mock-data.ts`. Admin has a feature-owned `admin-types.ts`, while many live UI files still import the duplicate mock declarations. The active `admin-presentation-type-ssot` change covers only three admin model files.

## Goals / Non-Goals

**Goals:** make live mappers own their consumer contracts; reduce mock modules to typed fixtures; remove dead values/helpers.

**Non-Goals:** duplicate the active admin change, change runtime shapes, or rename every admin type.

## Decisions

### Weekly types flow from the live mapper

`weekly-report-types.ts` is the canonical owner. Accordion, portfolio, page-view, helper, and print props use `Weekly*` types directly. Any field needed by those live consumers is corrected at that source rather than weakened to optional in a mock interface.

Before: `mapWeeklyReport -> structural assignment/cast -> mock type -> live component`.

After: `mapWeeklyReport -> Weekly* type -> live component`; test fixtures use `satisfies Weekly*`.

### Admin presentation types stay feature-owned

Remaining admin UI imports move to `features/admin/model/admin-types.ts`. Residual settings/stage declarations move there if absent. The three model files owned by `admin-presentation-type-ssot` are excluded from this change's edits.

### Delete values by usage proof

Each `MOCK_*`, `getUserById`, and `getLeadUsers` export is checked with tracked and untracked consumers in scope. Unreferenced values are deleted; retained fixtures import/satisfy live types. Type files must not depend back on mock modules.

## Risks / Trade-offs

- Optional mock fields may expose real call-site gaps → fix the canonical mapper/type or fixture, not with casts.
- Parallel work overlap → sequence after or rebase over `admin-presentation-type-ssot`; do not edit its three files.
- Tests may rely on fixture exports indirectly → use a repository-wide import/export audit before deletion.

## Invariants

Runtime behavior, wire schemas, role coverage, period dual-state, destructive-db, and deferred-feature behavior remain unchanged.
