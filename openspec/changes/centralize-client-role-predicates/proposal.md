## Why

Web components re-derive role identity inline — `role === "head" || role ===
"admin"` and friends appear across pages, hooks, and controls — so the same
question ("is this a head-like session?") is answered by hand at every site.
The backlog records this as the client permission-model centralization target.
The already-centralized pieces (the nav-links role table, `RoleGate`,
`IfRole`, the route-role map) are fine; the scatter is the inline identity
comparisons.

## What Changes

- Add `apps/web/src/lib/role-predicates.ts`: pure identity predicates over
  `Role | null` — `isHead`, `isAdmin`, `isLead`, `isViewer`, `isHeadLike`
  (head or admin). All return `false` for `null`. The header states the
  layer's contract: UX affordance only, NOT a security boundary — enforcement
  is the API's role-coverage gate (9 canonical middleware chains); no `can*`
  enforcement names belong here.
- Substitute the scattered inline comparisons at their call sites, operands
  unchanged: `use-lead-form-data.ts` (head-like session),
  `head-publish-lock-action.tsx` (local `canMutatePeriod` name kept, built
  from `isHeadLike`), `reports/page.tsx` (lead/head-like/viewer branches),
  `weekly-report-page.tsx` (`isReviewEnabled` keeps its explicit
  `role !== null &&` guard), `search-input.tsx`, `nav-bar.tsx` (viewer
  active-link branch), and `lead-form-header-actions.tsx` (the two
  `currentUser.authorRole` checks — SAME operand, only the comparison moves).
- Add a truth-table unit test for every predicate across all four roles plus
  `null`.
- Update `architecture-refactor-backlog`: record the centralization target as
  CLOSED.

Non-goals:

- No new authorization guards, no enforcement, no behavior change anywhere —
  every substituted expression stays value-identical for all role states.
- Server-computed flags (`canRequestReopen`, `canReview`, `canInlineEdit`)
  stay server-computed passthroughs.
- No changes to `RoleGate`, `IfRole` internals, `ROUTE_ROLE_MAP` literals, or
  the dev role switcher (its duplicate `Role` list is a separate cleanup).
- No `usePermissions()` hook and no feature compounds in the module —
  identity primitives only; compounds stay named at their call sites.
- `scope === "lead"` display-grouping checks and admin-tab user-row filters
  are NOT permission logic and are untouched.

## Capabilities

### New Capabilities

- `client-role-predicates`: Defines the client role-identity predicate layer
  and its not-a-security-boundary contract.

### Modified Capabilities

- `architecture-refactor-backlog`: Records the client permission-model
  centralization target as closed.

## Impact

- New: `apps/web/src/lib/role-predicates.ts` + `role-predicates.test.ts`.
- Touched call sites: 7 files in `apps/web/src` (substitution only).
- No API, database, dependency, route, or product UI behavior changes.
- Gates: focused tests, scoped ESLint with `--max-warnings 0`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and
  OpenSpec validation.
