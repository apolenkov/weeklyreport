---
name: v8.2 milestone closed 2026-05-18
description: v8.2 GSD Closure & Quality — all 5 phases done, tag v8.2.0 created, push pending SSL
type: project
originSessionId: b8d5b2af-032c-46f8-b3d9-3c5632cab382
---

v8.2 milestone fully closed on 2026-05-18. Tag `v8.2.0` created on branch `feat/head-report-history-slides`.

**Why:** Closure sweep for all v8.1 verification gaps and tech debt.

**How to apply:** Next milestone is v8.3 UAT + deferred items. Start with `/gsd-new-milestone v8.3`. REQUIREMENTS.md was deleted (archived to `milestones/v8.2-REQUIREMENTS.md`).

## What shipped

- Phase 67: 5 verification gaps closed (P14/P16/P35/P37/P39 → all `passed`)
- Phase 68: TD-01..06 closed (scopeDenied in trpc.router.ts, groupScopeFilter, PolicyApplicator in scheduler, etc.)
- Phase 69: 3 describe.skip retired, e2e/README.md added
- Phase 70: 7 plans archived, PNG artefacts cleaned, HEAD-CONSOLIDATE-01 + UFB-061 resolved
- Phase 71: ComingSoonBadge in packages/ui, 6 call-sites migrated

## Deferred to v8.3

- E2E-04: Reopen+Revoke stubs (11 test.fixme)
- E2E-05: a11y stubs (7 test.fixme)
- CS-02: ComingSoonBadge role-gate
- CS-08: Screenshots

## Stats

- 19 commits v8.1.0..v8.2.0
- 472/472 tests
- Push blocked: forge.example.org SSL (use `! git push origin feat/head-report-history-slides`)
