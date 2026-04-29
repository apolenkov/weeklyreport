---
phase: 27-quality-stabilisation-role-middleware-factory
plan: 02
status: complete
date: 2026-04-29
type: execute
requirements: [QA-03]
---

# Plan 27-02 Summary — Dead proxy.ts deletion + CC-6 guard comment

## Outcome

Dead `apps/web/src/proxy.ts` removed. CC-6 guard comment added to active `apps/web/proxy.ts`. Web typecheck clean. Single atomic commit.

## Scope deviation (logged)

Plan's three grep patterns (`from.*src/proxy`, `from "./proxy"`, `import.*src/proxy`) did NOT catch a relative import from `apps/web/src/server/auth/session.test.ts` (`from '../../proxy'`). After deleting the file, web typecheck failed with TS2307.

The test was an artefact of Phase 08-01 (when proxy lived in `src/`). It tested helpers (`buildLoginRedirect`, `shouldRedirectToLogin`, `requiresAuthentication`, `isPublicPath`) that no longer exist in the active root-level `apps/web/proxy.ts` — the active proxy uses different logic (`isProtectedPath`, body-guard pattern from Phase 24).

**Decision:** deleted the obsolete test alongside the dead file. The test's helpers are not consumed anywhere else (`grep -rn "buildLoginRedirect|shouldRedirectToLogin|requiresAuthentication|isPublicPath" apps/web/src/` returns empty). The test was testing dead code; removing it closes the dead-code loop cleanly and preserves the spirit of QA-03.

This expansion of scope (1 extra file delete) is recorded here per plan's deviation rules. No alternative was viable: keeping the test would require either restoring the dead helpers or rewriting the test against the active proxy — both contradict QA-03's intent.

## Files changed

- DELETED: `apps/web/src/proxy.ts` (dead, never invoked by Next.js 16)
- DELETED: `apps/web/src/server/auth/session.test.ts` (obsolete — tested deleted helpers)
- MODIFIED: `apps/web/proxy.ts` (+5 lines: CC-6 guard comment block above existing JSDoc)

## Verification

- `ls apps/web/src/proxy.ts` → No such file ✓
- `ls apps/web/src/server/auth/session.test.ts` → No such file ✓
- `grep "Phase 27 (QA-03) deleted the dead duplicate" apps/web/proxy.ts` → match ✓
- `pnpm --filter @customreport/web typecheck` → exit 0 ✓
- `grep -rn "buildLoginRedirect|shouldRedirectToLogin|..." apps/web/src/` → empty ✓

## CC-6 mitigation

The active `apps/web/proxy.ts` now carries an explicit comment block naming the deleted path. Future refactors that consider re-creating `apps/web/src/proxy.ts` will hit a visible warning in code review.
