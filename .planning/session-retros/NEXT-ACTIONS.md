# NEXT ACTIONS

updated: 2026-05-18T15:00:00Z source: v8.2 milestone open, Phase 70 in progress

## RUN FIRST

1. [ ] `pnpm typecheck && pnpm lint && pnpm test` — verify gates after Phase 70 changes

## AGENT

Phase 70 (Planning hygiene) — IN PROGRESS:

1. [x] Move 7 historical plans to done/ ← done
2. [x] Move lock-icon todo to done/ ← done
3. [x] Move .png artefacts to .planning/ui-reviews/2026-05-17-18/ ← done
4. [x] HEAD-CONSOLIDATE-01 redirect /head/slides → /head/history?mode=slides ← done
5. [x] UFB-061 version in login footer via NEXT_PUBLIC_APP_VERSION ← done
6. [x] Phase 43 GAP-01 SUMMARY.md created ← done
7. [ ] Commit Phase 70 changes

Phase 67 (Verification closure) — NEXT:

1. [ ] Read all 5 VERIFICATION.md files (P14, P16, P35, P37, P39)
2. [ ] Close or retire each gap with rationale
3. [ ] Update status → `passed` in each VERIFICATION.md

Phase 68 (Tech debt):

1. [ ] TD-01: scopeDenied event wire
2. [ ] TD-02: cross-group integration test
3. [ ] TD-03: search.service.ts refactor
4. [ ] TD-04: ReminderPolicy e2e spec
5. [ ] TD-05: PolicyApplicator perf test
6. [ ] TD-06: PolicyApplicator DI in period.service.ts + scheduler

Phase 69 (E2E):

1. [ ] 3 describe.skip blocks resolve/retire
2. [ ] Critical-path TODO stubs (Reopen+Revoke + a11y)
3. [ ] lead-form-foreign-author.spec.ts in regression config
4. [ ] e2e/README.md created

Phase 71 (Coming Soon):

1. [ ] Design + create ComingSoonCard component in packages/ui
2. [ ] 6 call-sites migrated
3. [ ] Role-gate implemented
4. [ ] Screenshots

## HUMAN

1. [ ] Ручной UAT: `/lead/report?authorId=<BORIS_UUID>` → badge показывает имя Бориса
2. [ ] Approve Coming Soon copy (6 cards) после Phase 71.1 draft
3. [ ] Approve финального audit-milestone отчёта

## BLOCKED

(нет блокеров — SSL issue с v8.1 разрешён, main актуален)

## VERIFY

```bash
pnpm typecheck                         # 0 errors
pnpm lint                              # 0 errors
pnpm test                              # 472+ tests pass
git grep -c "ComingSoonCard" apps/web/src/   # ≥ 6 (после Phase 71)
ls .planning/plans/*.md | wc -l        # 1 (только pure-mist)
git tag --list 'v8.2*'                 # v8.2.0 (после завершения)
```
