# Tasks

## 1. Signal handling

- [x] 1.1 Add RED tests in `scripts/gates/operations/backup-loop.test.ts`: SIGTERM during a stubbed `pg_dump` exits 143 in under 5 s and leaves no partial; SIGTERM during the standalone interval exits 143 and keeps the published dump. RED: 2 failed (`terminated by SIGTERM`), 15 passed.
- [x] 1.2 Trap TERM and INT in `backup-loop.sh`; run `pg_dump` and `sleep` in the background and `wait` for them; stop the child and remove the current partial in the handler. GREEN: 17 of 17 pass.
- [x] 1.3 Comment in `backup-loop.sh` states that the script runs as PID 1 and why the handler exists.

## 2. Verification and delivery

- [x] 2.1 `shellcheck deploy/postgres/backup-loop.sh` passes.
- [ ] 2.2 Run the six repository gates on the reviewed tree and record their exit codes in the handoff RESULT.
- [ ] 2.3 Native signal check on the exact backup image under a granted window (no cluster or `pg_dump` access in this change); remains open.
