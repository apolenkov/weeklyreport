# Tasks

- [x] 1. Spec delta for `period-dual-state`.
- [x] 2. RED unit tests: `publish-side-effects.test.ts` (3 fail + control), `auto-archiver.scheduler.post-commit.test.ts` (1 fail + control).
- [x] 3. Repair `publish-side-effects.ts` (guard the failure report on both catches) and `auto-archiver.scheduler.ts` (audit outside the write `try`, own guard); the guarded write still reports a real write error as `failed`.
- [ ] 4. C1177 stays open: needs a disposable-DB interleaving run.
- [ ] 5. Coordinator: six gates on the composed tree and independent review (018).
