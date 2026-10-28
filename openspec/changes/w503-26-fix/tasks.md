# Tasks

## 1. Provisioning guard (TASK-503.26, C0140)

- [x] 1.1 Add lexical contract tests for the lock order, the guard before the
      first write, and the four fixture pairs in
      `scripts/gates/operations/local-stand-provisioning.test.ts`; record the RED
      receipt against the unchanged SQL.
- [x] 1.2 Lock the two tables with `NOWAIT`, add the dataset guard before the
      first write, and keep the existing upserts and head assignment; verify the
      tests are GREEN.

## 2. Verification and handoff

- [x] 2.1 Run `openspec validate w503-26-fix --strict` and the focused contract
      test; record exit codes and logs in the handoff.
- [ ] 2.2 Native PostgreSQL RED and GREEN on an owner-approved synthetic target:
      NOT RUN in this change; requires an explicit target grant.
