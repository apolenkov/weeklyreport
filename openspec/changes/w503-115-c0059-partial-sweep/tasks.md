# Tasks

## 1. Partial sweep under the writer lock

- [x] 1.1 Add RED tests in `scripts/gates/operations/backup-loop-partial-sweep.test.ts`: a stale partial is removed at start while a completed dump within retention stays; a held writer lock leaves every partial in place. RED: 1 failed (`partial kept`), 17 passed; the held-lock test passed at once, as expected because the lock already stops the run before any file work.
- [x] 1.2 Add the sweep in `backup-loop.sh` directly after the successful `flock -n 9`, before the first dump; log the number of removed files. GREEN: 18 passed (both backup-loop test files).
- [x] 1.3 Comment in `backup-loop.sh` states why the sweep is safe: the held writer lock excludes any live writer.

## 2. Documentation and verification

- [x] 2.1 Add one sentence to `docs/operations.md` describing the start-time sweep under the lock.
- [x] 2.2 `shellcheck deploy/postgres/backup-loop.sh` passes.
- [x] 2.3 `openspec validate w503-115-c0059-partial-sweep --strict` reports valid.
- [ ] 2.4 Run the six repository gates on the reviewed tree and record their exit codes in the handoff RESULT.
