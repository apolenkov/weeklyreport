## Context

Role-identity comparisons are re-typed inline across `apps/web/src` while the
rest of the client permission surface is already single-sourced (nav-links
role table, `RoleGate` server gate, `IfRole` client gate, `ROUTE_ROLE_MAP`,
`ROLE_HOME_PATH`). Council grilling (two seats, independently verified
inventories) converged on: the scatter is exactly the inline identity checks
(~7 files); everything else is either already centralized, a server-computed
flag that must stay one, or a naming collision (`scope === "lead"` display
grouping; admin-tab filters over OTHER users' roles).

Adjudicated seat disagreements: module named `role-predicates.ts` over
`permissions.ts` (a permissions-named module invites `can*` enforcement creep
against the layer's contract); no `usePermissions()` hook (pure functions
compose with both client and server call sites and stay unit-testable); the
module carries identity primitives ONLY — feature compounds keep their local
names at call sites; the `lead-form-header-actions.tsx` `authorRole` pair is
in scope with an explicit operand warning.

Hard constraints honored:

- The user previously DECLINED expanding head-lifecycle authz guards — this
  change adds ZERO new checks; it renames how existing comparisons are
  spelled.
- The client layer is UX affordance, not a security boundary: enforcement is
  the API role-coverage gate (9 canonical middleware chains, CLAUDE.md) and
  the server-side `RoleGate` (threat model T1).
- Server-computed flags (`canRequestReopen` — reopen-request-lifecycle D4,
  `canReview`, `canInlineEdit`) pass through untouched.

## Goals / Non-Goals

**Goals:**

- One pure module answering role-identity questions; call sites import it
  instead of re-deriving.
- Truth-table tests pinning `null → false` for every predicate.
- Close the backlog target.

**Non-Goals:**

- No behavior change (component tests must pass UNCHANGED — that is the
  proof), no new guards, no hook, no policy engine, no route-map edits, no
  `IfRole` data-source change, no dev-switcher cleanup.

## Decisions

### D1: Pure predicates over `Role | null` in `apps/web/src/lib/role-predicates.ts`

`isHead`, `isAdmin`, `isLead`, `isViewer`, `isHeadLike`. Pure functions —
no React, no `'use client'` — so the client hooks, server components, and
plain modules all import the same seam. Callers pass their existing operand
(`sessionRole`, `user?.role ?? null`, `currentUser.authorRole`); the null
coalescing stays AT the call site so SSR/hydration output is unchanged.

Alternative rejected: a `usePermissions()` object hook — client-only,
re-render surface, and a natural slippery slope toward the forbidden policy
engine.

### D2: Identity primitives only — compounds stay local

`canMutatePeriod`, `usesCompiledHistory`, `searchScope`, `isReviewEnabled`
keep their local names and semantics, now BUILT from primitives. Two sites
(`isReviewEnabled`, `usesCompiledHistory`-adjacent export gate) both resolve
to "non-lead access-holder" today; they stay separate expressions
(`role !== null && !isLead(role)`) because they gate independently-evolving
features — a shared `isNonLead` name would couple them.

### D3: The `authorRole` pair moves with its operand frozen

`lead-form-header-actions.tsx` gates Request-Reopen vs Revoke on
`currentUser.authorRole` — a value derived from the SERVER read model's
section author, deliberately not the live session role. The substitution is
`isLead(currentUser.authorRole)` — comparison only. Rewiring the operand to
`useSession()` "for consistency" would change loading semantics and is
forbidden here.

### D4: Null semantics are part of the contract

Every predicate returns `false` for `null`. Sites whose original expression
distinguishes null explicitly (`role === null || role === "lead"` inverted as
`role !== null && !isLead(role)`) keep the explicit guard so no cold-load /
skeleton branch flips.

## Risks / Trade-offs

- Null-handling drift -> D4 + truth-table tests + component tests unchanged.
- Hydration/nav flicker -> callers keep their `?? null` and hydration gating;
  predicates never touch React state.
- Enforcement creep -> module name, header contract, no `can*` exports;
  review checks imports stay type-only + comparisons.
- Operand swap on the authorRole pair -> D3 warning in tasks; verifier diffs
  operands byte-for-byte.
- Over-centralization -> the deliberate out-list in the proposal (route maps,
  gates, dev switcher, display-scope checks) is part of the spec scenario.

## Migration Plan

1. Add `role-predicates.ts` + `role-predicates.test.ts` (truth tables).
2. Substitute the 7 call-site files, operands and null-guards verbatim.
3. Update the backlog spec and delta: target CLOSED.
4. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation — component tests pass with zero edits.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
