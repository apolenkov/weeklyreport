## Context

The durable directory standard already requires API cross-module access through facades and keeps `app/` routing-only. Two temporary API exceptions remain in `eslint-config/boundaries.ts`: root-level `published-report-snapshot.ts` and `report-escalations.ts`. The archived slice plan assigns snapshot/read-model ownership to `report-sections`, whose mappers and effective-status derivation they already consume. Separately, the `/reports` route owns 337 lines of history query/state and UI across four files even though `features/period` already owns period navigation and lead-history presentation.

The change is behavior-neutral. It changes no request path, Prisma query, shared schema, route, role middleware, or persisted state.

## Goals / Non-Goals

**Goals:**

- Give the two API projections one deterministic owner and one public facade.
- Make `/reports/page.tsx` route composition-only.
- Delete, rather than widen, the temporary API boundary exceptions.
- Preserve exact runtime behavior and test coverage through file moves and import rewrites.

**Non-Goals:**

- Rework projection logic, history behavior, or shared contracts.
- Move the path-sensitive print/PDF route subtree.
- Tighten `packages/ui` exports or reorganize flat operational roots.

## Decisions

### 1. Report-sections owns published snapshot projections

Move both projections and their tests under `apps/api/src/modules/report-sections/infrastructure/`, then export the required functions and types from `report-sections/index.ts`. The builders are coupled to `reportSectionFullInclude`, `mapPrismaToReportSection`, and effective section-status derivation; this follows the previously settled ownership decision more closely than placing them in publication, which is only one consumer.

All archive, PDF, period, publication, and weekly-report consumers import the `report-sections` facade. No consumer imports the new internal path. The temporary loose-root exceptions are deleted from `eslint-config/boundaries.ts`.

Before:

```text
modules/* consumers --> modules/published-report-snapshot.ts
                    --> modules/report-escalations.ts
```

After:

```text
modules/* consumers --> report-sections/index.ts
                          |
                          +--> infrastructure/* projections
```

Alternative rejected: `src/lib`. These projections are report-section-specific domain adapters, not owner-less general utilities.

### 2. Period feature owns report-history state and UI

Move the history query/state hook and role-view derivation into `features/period/model/`, and the panel/toolbar into `features/period/ui/`. Export only the four route entry points from the existing minimal period barrel. `/reports/page.tsx` keeps route composition, title/subtitle assembly, and feature invocation; it owns no query or presentation implementation.

Alternative rejected: a new `report-history` slice. The surface navigates reporting periods and already composes period-owned history components, so a second overlapping domain would violate the canonical-domain rule.

### 3. Preserve behavior with move-sensitive verification

Use `git mv`, update mocks/imports without rewriting logic, and run focused source tests before broader gates. The period dual-state invariant, role-coverage gate, destructive-database guard, and deferred-feature pattern are preserved unchanged. No database operation or rollout flag is involved.

## Risks / Trade-offs

- **Mock paths can silently stop intercepting after relocation** -> update every literal mock path and prove the production import graph with focused tests plus TypeScript.
- **A facade can become a mega-barrel** -> export only symbols used outside the slice; tests inside the owner use local paths.
- **Route rendering can drift during web moves** -> retain component bodies byte-for-byte where possible and run route/component tests plus final Playwright visual evidence.
- **Final runtime evidence becomes stale after moves** -> complete and commit this change before freezing the next runtime-sweep source SHA.

## Migration Plan

1. Move API projection sources/tests, reroute consumers through the facade, remove exceptions, and run focused API unit/integration boundary gates.
2. Move web history model/UI, expose minimal period entries, thin the route, and run focused web tests/typecheck/lint.
3. Run full local gates before freezing runtime evidence. Rollback is a pure reverse move/import change; no data rollback exists.

## Open Questions

None.
