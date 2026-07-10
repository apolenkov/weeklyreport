## 1. Predicate module

- [x] 1.1 Add `apps/web/src/lib/role-predicates.ts`: `isHead`, `isAdmin`,
      `isLead`, `isViewer`, `isHeadLike` over `Role | null`, all `false` for
      `null`; header comment stating the UX-affordance contract and pointing
      enforcement at the API role-coverage gate; no `can*` exports.
- [x] 1.2 Add `role-predicates.test.ts`: truth table per predicate across
      lead/head/admin/viewer/null.

## 2. Call-site substitution (operands and null-guards verbatim)

- [x] 2.1 `use-lead-form-data.ts`: head-like session check via
      `isHeadLike(sessionRole)`.
- [x] 2.2 `head-publish-lock-action.tsx`: local `canMutatePeriod` built from
      `isHeadLike`.
- [x] 2.3 `reports/page.tsx`: lead/head-like/viewer branches via predicates;
      scope-mapping stays page-local.
- [x] 2.4 `weekly-report-page.tsx`: `isReviewEnabled` becomes
      `role !== null && !isLead(role)` (explicit null guard KEPT); the admin
      branch via `isAdmin`.
- [x] 2.5 `search-input.tsx`: viewer check via `isViewer(user?.role ?? null)`.
- [x] 2.6 `nav-bar.tsx`: viewer active-link branch via `isViewer(role)`.
- [x] 2.7 `lead-form-header-actions.tsx`: the two `authorRole` checks become
      `isLead(currentUser.authorRole)` / negation — operand MUST stay
      `currentUser.authorRole` (server read model), never the session role.

## 3. Verification

- [x] 3.1 All existing component tests pass UNCHANGED (zero test edits — the
      no-behavior-change proof).
- [x] 3.2 Update `openspec/specs/architecture-refactor-backlog/spec.md` and
      the matching change delta: target CLOSED.
- [x] 3.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      and `git diff --check`, then validate this change with `--strict` and
      run the full strict OpenSpec validation.
