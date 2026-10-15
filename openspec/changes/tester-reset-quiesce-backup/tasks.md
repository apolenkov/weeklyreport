# Tasks

## 1. Reset quiesces backups

- [x] 1.1 RED: reset tests for suspend-before-migrate and resume, already suspended CronJob, unfinished backup and unreadable state.
- [x] 1.2 Record, suspend and drain backups in `reset.sh` before the API scale-down; restore the recorded state in the cleanup trap.
- [x] 1.3 Document the backup quiesce in `deploy/tester-kit/README.md`.

## 2. Verification and delivery

- [ ] 2.1 GREEN, six gates on the reviewed tree and independent review.
- [ ] 2.2 Native on the tester stand under a granted window: reset during an active backup Job waits or refuses; CronJob state restored.
