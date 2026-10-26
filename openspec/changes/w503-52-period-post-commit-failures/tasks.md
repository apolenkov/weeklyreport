# Tasks

- [x] 1. Spec deltas as MODIFIED requirements in `publish-compare-and-set` and `period-scheduler-wiring`, matching the owners of the affected behavior.
- [x] 2. RED unit tests: `publish-side-effects.test.ts` (3 fail + control) and the post-commit scheduler cases in `auto-archiver.scheduler.test.ts` (1 fail + control).
- [x] 3. Repair `publish-side-effects.ts` (guard the failure report on both catches) and `auto-archiver.scheduler.ts` (audit outside the write `try`, own guard); the guarded write still reports a real write error as `failed`.
- [x] 4. Review 1: each post-commit report call (log line, audit, fallback error line) is guarded on its own, and the scheduler post-commit cases use the existing suite helpers.
- [ ] 5. C1177 stays open: needs a disposable-DB interleaving run.
- [ ] 6. Coordinator: six gates on the composed tree and independent review (018).
