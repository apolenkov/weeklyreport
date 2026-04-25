# Deferred Items - Phase 22

Items discovered during plan execution that are out of scope for the current plan and should be addressed elsewhere.

## From 22-02 (Status<->Risk Sync)

### TS errors in apps/web/src/lib/use-cursor-pagination.ts (pre-existing)

- **Line 113:** `Property 'pages' does not exist on type 'CursorPage<TItem>'.`
- **Line 115:** `Parameter 'p' implicitly has an 'any' type.`
- **Source:** Introduced by 22-03 plan (commit `d8b9bdd feat(22-03): add useCursorPagination hook`).
- **Owner:** Plan 22-03 should follow up; not in 22-02's scope.
- **Detected:** During 22-02 typecheck verification. Scope-boundary rule: only auto-fix issues directly caused by current task's changes.

### Failing tests in apps/web/src/components/lead/lead-form.test.tsx (pre-existing)

- **Tests:** 4/4 failing (submit success, submit error, dirty marker, revoke success).
- **Source:** Owned by plan 22-01 (parallel wave); tests reference real lead-form mutation wiring that 22-01 is implementing.
- **Owner:** Plan 22-01 will address as part of its mutation wiring work.
- **Detected:** During 22-02 full vitest run. Verified failures existed pre-22-02 via `git stash && vitest run`. Out of scope.
