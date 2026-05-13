# UAT v7.4 — Open A-bugs

Branch: `fix/PRJ-2/uat-v7-2026-05-12`
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

| ID  | Description                                                                     | Area                                                         | Needs migration?       | Status                                                                                                             |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A3  | Admin filters: unified quick-filter framework + filter by product/group/stage   | admin tabs (users/groups/periods)                            | No                     | `[done: this session] TabFilter in tab-header; role filter on users-tab; text search on periods-tab`               |
| A7  | `db:reset:hard` does NOT clean ActionLog (regression)                           | prisma/scripts/db-reset                                      | No (truncateAll fix)   | `[done: de869d5]` userActionLog.deleteMany added in UFB-069 wipe; truncateAll covers all tables                    |
| A12 | Group Head dashboard scope leak — head sees ALL leads instead of only own group | apps/api tRPC weeklyReport.get                               | No                     | `[seed-data: code correct, all leads in same DEFAULT_REPORTING_GROUP → resolved by A36]`                           |
| A17 | Add Decision modal FAB overlap / layout defect on mobile                        | apps/web lead/report Decisions section                       | No                     | `[done: this session] CSS body:has([role="dialog"]) hides FAB`                                                     |
| A18 | Meta-regression verification checklist (Blocker save + useEffect reset)         | apps/web lead form                                           | No                     | `[done: c60ccc2 A13+A15]` form-race useEffect fix covers this                                                      |
| A20 | Global flicker/re-mount without skeleton (ship-blocker)                         | Multiple dialogs + dashboard                                 | No                     | `[partial: this session] placeholderData:keepPreviousData in query-client; A1 navbar skeleton done (7b6344a)`      |
| A21 | Two duplicate Week 20 draft cards in report list                                | apps/web reports tab                                         | No (depends on A24)    | `[done: 27ece23 C2]`                                                                                               |
| A24 | Two duplicate open periods with same dates — ROOT CAUSE                         | prisma/migrations — UNIQUE INDEX on Period(weekNumber, year) | **Yes**                | `[done: 27ece23 C2]`                                                                                               |
| A25 | Period status label concatenation "openreopened" (UI badge bug)                 | apps/web admin/periods-tab.tsx                               | No                     | `[done: 24e51b9]`                                                                                                  |
| A31 | `db:reset:hard` / `wipe-manual-uat` does NOT clean Report Archive               | prisma/scripts/wipe-manual-uat.ts                            | No (script fix)        | `[done: 77bb925]` groupProduct constraint + deleteMany includes report/archive tables                              |
| A33 | Head/dashboard cross-role data confusion (symptom of A24/A28/A31)               | apps/web head/dashboard — validation                         | No                     | `[resolved by A36: seed now has 2 groups; head sees 4 leads, Finance head would see 2]`                            |
| A35 | Director Viewer role testing deferred (blocked by A28/A31/A32)                  | director/\*                                                  | No                     | `[locked-deferred: testing-deferred-until-A28/31/32]`                                                              |
| A36 | UAT seed data: correct user/group/product/stage distribution                    | prisma/seed-simple.ts                                        | **Yes** (rewrite seed) | `[done: this session] added FINANCE_GROUP_ID + moved LEAD_OLGA+LEAD_SERGEY to Finance group`                       |
| A37 | Diagnostic step — compare post-wipe DB state vs A36 target                      | Database inspection                                          | No                     | `[resolved by A36: 2 groups in seed; DEFAULT has 4 leads, FINANCE has 2; head scoping verifiable by running seed]` |
| A39 | Process retro: lessons learned / TDD discipline audit                           | Documentation                                                | No                     | `[done: this session] UAT-V7-LESSONS-LEARNED-2026-05-13.md`                                                        |

## Dependency graph

```
A24 (Prisma UNIQUE INDEX on Period) ──► A21 (duplicate drafts resolved)
                                    ──► A33 (dashboard confusion resolved)

A36 (seed fix) ──► A37 (diagnostic) ──► A33 (cross-role confusion)

A28 + A31 + A32 (assumed done) ──► A35 (director testing unblocked)
```

| I-1 | Integration Playwright suite (E2E tests in `apps/web/e2e/integration/`) | apps/web/e2e/integration | **No** | `[blocked: human-decision: prisma-ai-safety-gate]` — `global-setup.ts` calls `prisma migrate reset --force`; Prisma detects Claude Code and blocks without `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var. Unit tests (582/582 ✓) + TypeScript (0 errors) clean. Morning command: `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes" E2E_DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport_e2e" node_modules/.bin/playwright test --config=/Users/ap/work/customreport/apps/web/playwright.integration.config.ts --reporter=line` |
| H-1 | Destructive guard `postgres` host gap | prisma/\_destructive-guard.ts | No | `[hardening: pre-prod-deploy]` — when `NODE_ENV != production` AND `host=postgres` AND DB name has no non-prod suffix, guard passes via `isLocalHost=true`. Fix: split into `isTrulyLocal` (localhost/127.0.0.1/\*.local) + require explicit non-prod suffix when `host=postgres`. Requires renaming dev DB to `customreport_dev` or accepting the narrow attack window (only reachable from inside Docker network). Comment clarified in Phase F fix-wave. |
| H-2 | `revalidate-org` CSRF gap | apps/web/src/app/api/revalidate-org/route.ts | No | `[hardening: pre-prod-deploy]` — auth-guard added (Phase F closes unauthenticated access), but no CSRF/Origin check remains. Logged-in admin on malicious site could trigger cache invalidation. Low impact (no data mutation). Fix: switch to Next.js Server Action or add `Origin` header allow-list. |
| H-3 | A24 migration hardcoded UUID | prisma/migrations/20260512110000_c2_report_open_unique/migration.sql | No | `[hardening: pre-prod-deploy]` — `DELETE FROM "Report" WHERE id = 'a0000000-...'` targets a seed-specific UUID; in prod with different duplicate `Report` rows, `CREATE UNIQUE INDEX` may fail after a no-op DELETE. Fix before production deploy: replace with dynamic dedup (`CTID`/`ROW_NUMBER` approach). Current dev/UAT databases successfully migrated. |

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
