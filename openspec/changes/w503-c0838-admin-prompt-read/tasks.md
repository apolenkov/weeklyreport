# Tasks

## API

- [x] 1.1 Prepare a real-Prisma public-service regression with root/transaction client interception, observed control/writer/history ordering, bounded waits and finally-release; verify source-only typecheck, formatting and lint before native execution.
- [x] 1.2 Coordinator runs the focused integration file on its guarded seeded PostgreSQL target and records actual RED caused by contradictory lifecycle for the same revision identifier; see `~/work/handoffs/task-503/wave-08/c0838-native-red.json` and `c0838-native-red-test.log` (4 passed / 1 intended failure, fixture unchanged).
- [x] 1.3 After native RED, wrap both getControl reads in the existing RepeatableRead callback transaction pattern; verify the unchanged interleaving passes and missing-control/newer-draft cases remain valid.

The unchanged real-Prisma fixture passed all five native cases after the transaction patch; `~/work/handoffs/task-503/wave-08/c0838-native-green.json` binds the repository and fixture hashes to the guarded lane-E result and restored demo state.

## Integration and delivery

- [x] 2.1 Check owned-file formatting, scoped git diff --check and `pnpm exec openspec validate w503-c0838-admin-prompt-read --strict`; retain commands, exits and source hashes in `~/work/handoffs/task-503/wave-08/c0838-green-ready.md`.
- [ ] 2.2 Coordinator runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm spec:check` on the reviewed tree, obtains independent review and delivers through normal hooks.
