# Tasks

## Spec correction

- [x] T1: In `openspec/specs/period-dual-state/spec.md`, replace the
      "Lead section save updates both fields" scenario under "Atomic Dual-State
      Write" with the head-publish writer (a real period writer). Lead-section
      save writes no `Report` period field.
- [x] T2: Rewrite "All Six Writers Must Comply" to "All Report-Period Writers
      Must Comply": drop carry-over and lead-section-save; enumerate the real
      writers (head-publish, archive, manual admin edit, unarchive, auto-archiver + period-creator schedulers, snapshot-restore) and state each complies by
      calling `period-transition.ts::buildTransition` within its own transaction.
- [x] T3: Update the "Consumer surfaces" line (spec.md:5) to drop
      `apps/api/src/modules/weekly-report/` and `apps/api/src/modules/carry-over/`
      as period writers (they remain readers / child-row writers).

## Verification

- [x] T4: `rg -n "report\.(update|create)" apps/api/src/modules/{carry-over,weekly-report}`
      returns nothing (confirms neither is a Report writer) — already verified
      this session; re-run as the acceptance check.
- [x] T5: `openspec validate fix-period-dual-state-writer-count --strict` passes.

## Notes

- No application code changes — the code is correct; only the spec drifted.
- Evidence captured in `/tmp/catalog-findings-backup/_gaps.md` §3 (this session).
