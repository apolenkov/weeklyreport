# Tasks

- [ ] T1: Map critical paths — document the main read/write paths affected by
      IE/cache/index edge cases: section autosave, item mutations, risk updates,
      report publish
- [ ] T2: Audit current logging — run `grep -r "logger\|console\|AppLogger"
apps/api/src` and identify which critical paths have log statements
- [ ] T3: Document coverage gaps — create a table with path name, current log
      coverage (none/sparse/adequate), and proposed additions
- [ ] T4: Propose targeted additions — suggest 3–5 strategic log points
      (mutation start, cache invalidation, index refresh, error cases)
- [ ] T5: Create logging follow-up task — if gaps are significant, file a
      separate task for Phase 62+ logging infrastructure improvement
- [ ] T-V: Coverage audit report — save to `.planning/reports/2026-05-25-log-coverage-audit.md`
