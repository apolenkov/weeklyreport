# Tasks

## 1. Writer lock

- [x] 1.1 Add RED unit tests: a held lock stops both modes with status 75 before any backup work; the lock is taken before pg_dump, is private, and survives retention.
- [x] 1.2 Take `flock -n` on fd 9 for `$BACKUP_DIR/.backup-writer.lock` after the directory exists; verify GREEN with all existing backup-loop tests.
- [x] 1.3 Document the lock, status 75 and the writers it cannot bind in `docs/operations.md`.

## 2. Verification and delivery

- [x] 2.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the reviewed tree; independent review.
- [ ] 2.2 Native on the exact backup image under a granted window: flock applet present, second writer refused, lock free after SIGKILL, lock held by an orphaned pg_dump child.
