# Phase 66 Plan - Closure: Final Audit, PR, And Tag

## Goal

Finish v8.1 closure through GSD instead of ad hoc status updates.

## Scope

- Final GSD health/progress/stats checks.
- `$gsd-audit-milestone v8.1` equivalent.
- PR #5 or successor PR merge decision.
- v8.1 tag only after audit and CI green.

## Tasks

1. Run final GSD audit.
2. If verdict is `PASSED`, complete milestone.
3. If verdict is `TECH-DEBT`, insert one cleanup phase.
4. If verdict is `GAPS-FOUND`, insert closure phases grouped by audit
   findings.
5. If verdict is `BLOCKED-BY-CI`, keep merge/tag blocked.

## Verify

- `pnpm lint:md` passes.
- CI green exists for the merge commit or PR head.
- `STATE.md` and v8.1 milestone docs match final audit verdict.

## Exit

Phase exits when v8.1 is either completed/tagged or blocked by an explicit
external CI condition with no hidden repo work remaining.
