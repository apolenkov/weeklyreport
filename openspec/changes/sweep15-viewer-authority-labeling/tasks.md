## 1. Authority presentation model

- [x] 1.1 Derive an exhaustive viewer authority model from loaded `periodStatus`: open maps to `Draft`, reopened to `Reopened`, and published to `Published`
- [x] 1.2 Expose the authority model through the viewer report header/toolbar without changing head or lead header state

## 2. Viewer labeling

- [x] 2.1 Render the exact banner `Working report — includes drafts` for open and reopened viewer reports in both form and slide modes
- [x] 2.2 Render `Draft`, `Reopened`, or `Published` in the viewer header and omit the working banner for published reports
- [x] 2.3 Confirm the viewer surface remains read-only and the published-search query/surface is unchanged

## 3. Tests

- [x] 3.1 Add viewer shell/header tests for open, reopened, and published states using only English UI strings
- [x] 3.2 Assert working reports expose no lifecycle or edit controls and published reports expose no working banner
- [x] 3.3 Assert viewer Search remains published-only and receives no draft scope control

## 4. Repo gates

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck`
- [x] 4.3 `pnpm lint`
- [x] 4.4 `pnpm test`
