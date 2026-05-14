# NEXT ACTIONS

updated: 2026-05-14T14:23:53Z source: live Codex verification

## RUN FIRST

1. [x] `rtk gh run list --limit 5` / `gh run list --json ...` -> CI PR #5
       проверен live.
2. [x] Старые runs были не очередь: `277097` on `e4a6bfd` =
       `completed/startup_failure`, jobs/logs empty.
3. [x] После `ffb3a15` + later commits новый CI run уже создал checks
       и сейчас `queued`.
4. [ ] Merge PR #5 заблокирован до реального green check:
       `gh pr merge 5 --merge` делать только после реального green check.

## AGENT

1. [x] Обновить STATE.md: закрыть Phase 44/46/47/48/49 → пересчитать
       `percent` (98)
2. [x] Reconcile coverage gaps:
   - E-04: `alert-bar.test.tsx` covers dispatch failure toast (`45e1cac`)
   - E-08: already covered by `dashboard-advanced.spec.ts` SC-176
   - UFB-024: already covered by `phase16-17-uat.spec.ts` as `SKIPPED`
3. [x] Зеркало памяти: copied only missing files from
       `~/.claude/projects/-Users-ap-work-customreport/memory/` into
       `.planning/memory/`; repo-only files preserved.
4. [x] Создать repo-only remaining backlog:
       `.planning/session-retros/CUSTOMREPORT-REPO-REMAINING-2026-05-14.md`

## HUMAN

1. [ ] D-12: Item-dialog status pill reset — reverted из-за конфликта с react-compiler. Нужно решение по подходу.
2. [ ] Выбрать следующий milestone после закрытия PR #5 (Phase 43 Tooling ещё не завершён формально — есть TOOL-02..TOOL-06).

## BLOCKED

- CI PR #5: latest run is queued after workflow fixes. If it stays
  queued, runner/policy remains the likely blocker; repo runners API currently
  returns `total_count: 0`.

## VERIFY

```bash
gh run list --limit 5 --json databaseId,status,conclusion,headSha
gh pr view 5 --json statusCheckRollup
gh api repos/apolenkov/customreport/actions/runners \
  --hostname ghe.example.org | jq '.total_count'
grep "percent:" .planning/STATE.md
ls .planning/regression/COVERAGE-GAP-2026-05-14.md
pnpm --filter @customreport/web exec tsc --noEmit
pnpm --filter @customreport/web test -- alert-bar.test.tsx
```

## DETAILS

- TOOL-01 commits: `1bca336`, `d19a1b9`
- CI fixes: `e4a6bfd` restored GitHub-owned `actions/*@v4`; `ffb3a15`
  replaced `pnpm/action-setup` with Corepack. Post-fix runs reached
  queued checks.
- E-04 coverage: `45e1cac`
- Regression: 179/179 PASS — `results.json` in `.planning/regression/agent-b-test-results/`
- Coverage gap: `.planning/regression/COVERAGE-GAP-2026-05-14.md`
- Phase completion evidence: 44✓ 46✓(summary files, no PHASE-SUMMARY) 47✓(summary files, no PHASE-SUMMARY) 48✓ 49✓ 52✓ 54✓ 55✓ 56✓ 57✓
