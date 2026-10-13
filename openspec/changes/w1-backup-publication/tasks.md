# Tasks

## 1. Backup producer

- [x] 1.1 Reserve unique private temporary files and reject skipped publication; verify same-second payload preservation and non-clobber filesystem RED/GREEN through actual RUN_ONCE.
- [x] 1.2 Apply umask 077 while preserving existing mounted modes; verify 0700 new directories, 0600 partial/completed files and unchanged 0775 existing directory.
- [x] 1.3 Preserve failure cleanup, retention and dated health consumers; verify native filesystem failure, freshness and retention controls in the existing backup-loop tests.

## 2. Planning and documentation

- [x] 2.1 Update only the operations backup filename sentence; verify changed-file Prettier, ESLint, shell syntax, git diff --check and openspec validate w1-backup-publication --strict; deliver the scoped diff, receipts and hashes.
- [ ] 2.2 Coordinator runs pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the reviewed tree plus independent review and release acceptance.

## Workflow follow-up

- Coordinator owns delivery and OpenSpec archival; image/PG/cluster acceptance is separate from local producer proof.
