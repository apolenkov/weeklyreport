## 1. Dashboard row behavior

- [x] 1.1 Simplify `ActivityLivePanel` row branching so `hasContent` alone selects the focused-report anchor for both draft and submitted rows
- [x] 1.2 Preserve the draft status pill/copy and apply the shared interactive focus, hover, title, and link semantics to draft rows
- [x] 1.3 Keep zero-content rows as inert empty-state containers with no report link

## 2. Tests

- [x] 2.1 Replace inert-draft expectations with assertions for the exact `/head/report/[reportId]?authorId=[leadId]` target and accessible link name
- [x] 2.2 Retain submitted-row link coverage and add keyboard-focus affordance assertions
- [x] 2.3 Assert a row with zero items, risks, decisions, and priorities remains non-interactive

## 3. Repo gates

- [x] 3.1 `pnpm --filter @customreport/api db:generate`
- [x] 3.2 `pnpm typecheck`
- [x] 3.3 `pnpm lint`
- [x] 3.4 `pnpm test`
