# UAT v7.4 — Open A-bugs

Branch: `fix/PRJ-11/uat-v7-2026-05-12`
Extracted: 2026-05-13 via Phase D.1 grep of session-digest-comprehensive-uat-regression-suite.md
Cross-checked: git log origin/main..HEAD to exclude already-committed IDs

## Status legend

- `[ ]` — open, not yet committed
- `[done]` — committed on this branch
- `[locked-deferred]` — intentionally deferred (Phase 54/55)
- `[blocked: human-decision]` — needs user input
- `[handoff: ctx-limit-reached]` — left for next session

---

## Open A-bugs (extracted from digest)

| ID  | Description                                                                     | Area                                                         | Needs migration?       | Status                                                |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | ----------------------------------------------------- |
| A3  | Admin filters: unified quick-filter framework + filter by product/group/stage   | admin tabs (users/groups/periods)                            | No                     | `[ ]`                                                 |
| A7  | `db:reset:hard` does NOT clean ActionLog (regression)                           | prisma/scripts/db-reset                                      | No (truncateAll fix)   | `[ ]`                                                 |
| A12 | Group Head dashboard scope leak — head sees ALL leads instead of only own group | apps/api tRPC weeklyReport.get                               | No                     | `[ ]`                                                 |
| A17 | Add Decision modal FAB overlap / layout defect on mobile                        | apps/web lead/report Decisions section                       | No                     | `[ ]`                                                 |
| A18 | Meta-regression verification checklist (Blocker save + useEffect reset)         | apps/web lead form                                           | No                     | `[ ]`                                                 |
| A20 | Global flicker/re-mount without skeleton (ship-blocker)                         | Multiple dialogs + dashboard                                 | No                     | `[ ]`                                                 |
| A21 | Two duplicate Week 20 draft cards in report list                                | apps/web reports tab                                         | No (depends on A24)    | `[done: 27ece23 C2]`                                  |
| A24 | Two duplicate open periods with same dates — ROOT CAUSE                         | prisma/migrations — UNIQUE INDEX on Period(weekNumber, year) | **Yes**                | `[done: 27ece23 C2]`                                  |
| A25 | Period status label concatenation "openreopened" (UI badge bug)                 | apps/web admin/periods-tab.tsx                               | No                     | `[ ]`                                                 |
| A31 | `db:reset:hard` / `wipe-manual-uat` does NOT clean Report Archive               | prisma/scripts/wipe-manual-uat.ts                            | No (script fix)        | `[ ]`                                                 |
| A33 | Head/dashboard cross-role data confusion (symptom of A24/A28/A31)               | apps/web head/dashboard — validation                         | No                     | `[ ]`                                                 |
| A35 | Director Viewer role testing deferred (blocked by A28/A31/A32)                  | director/\*                                                  | No                     | `[locked-deferred: testing-deferred-until-A28/31/32]` |
| A36 | UAT seed data: correct user/group/product/stage distribution                    | prisma/seed-simple.ts                                        | **Yes** (rewrite seed) | `[ ]`                                                 |
| A37 | Diagnostic step — compare post-wipe DB state vs A36 target                      | Database inspection                                          | No                     | `[ ]`                                                 |
| A39 | Process retro: lessons learned / TDD discipline audit                           | Documentation                                                | No                     | `[ ]`                                                 |

## Dependency graph

```
A24 (Prisma UNIQUE INDEX on Period) ──► A21 (duplicate drafts resolved)
                                    ──► A33 (dashboard confusion resolved)

A36 (seed fix) ──► A37 (diagnostic) ──► A33 (cross-role confusion)

A28 + A31 + A32 (assumed done) ──► A35 (director testing unblocked)
```

## Priority order (from advisor D.2 phase)

1. **A24** — root cause of A21/A33, needs Prisma migration → do first
2. **A12** — head scope leak, query-level fix, no migration
3. **A25** — quick UI badge fix (1 LOC)
4. **A31** — wipe script extension
5. **A7** — db:reset:hard ActionLog cleanup
6. **A36** — seed rewrite (bigger, needs care)
7. **A3** — admin filters UX (non-blocking)
8. **A17** — Decision modal FAB overlap (UI)
9. **A20** — global flicker (React Query config)
10. **A18/A21/A33/A37** — validation / meta tasks (do after A24/A36)
11. **A39** — retro doc (end of session)
12. **A35** — deferred (testing director role)
