# Proposal

## Why

The tester-kit `start.sh` first-start probe coerces a failed `User` count query
to `0` (`|| echo 0` with suppressed stderr), so an unreachable postgres, an
auth failure, or a missing table triggers the destructive `reset.sh` as if the
dataset were verified empty (ticket `ops-seed-probe-fail-closed`). Separately,
`--registry` login places `REGISTRY_PASSWORD` on the child `kubectl` argv via
`--docker-password` (ticket `ops-registry-secret-argv`). Both are confirmed at
the reviewed source; evidence lives in the coordinator's D37-V10 handoff.

## What Changes

- `start.sh` runs the first-start `User` count probe visibly and exits
  non-zero when it fails, reaching the guarded reset only after a successful
  count of `0`.
- `start.sh --registry` passes the docker-registry credentials through a
  private 0600 file under `STATE_DIR` and `--from-file`, so the password never
  reaches a child command line, and removes the file afterwards. The file is
  serialized by Node's `JSON.stringify` reading the credentials from its
  inherited environment, so arbitrary credential characters cannot corrupt
  the document and no secret literal reaches the serializer's argv.
- `start.sh` expands an empty `PULL_ARGS` with the same `[@]+` idiom the other
  tester-kit scripts already use, so it no longer aborts under the stock
  `/bin/bash` 3.2 on macOS.
- `env.sh` port-forward helpers no longer treat a bare PID as identity:
  `pf_start` records the child PID with its start time and forward target,
  and `pf_stop` signals the recorded PID only while the live process still
  matches that identity; missing, old-format, dead or mismatched records
  fail closed and are never signalled.

## Capabilities

### Modified Capabilities

- `operations-local-readiness`: the tester-stand bootstrap is part of the
  fail-closed local safety automation; a failed first-start probe refuses
  instead of resetting, and registry credentials stay off child argv.

## Impact

Two tester-kit scripts (`deploy/tester-kit/start.sh`, `deploy/tester-kit/env.sh`)
and the focused gate test (`scripts/gates/operations/tester-kit-start.test.ts`,
the declared owner). The pidfile now holds PID, start time and forward target;
callers keep their existing `pf_start`/`pf_stop` signatures. No dependency,
schema, runtime, hook or CI changes. The chart contract is untouched: it
never created registry credentials.

## Non-goals

- Readiness probing of backgrounded port-forwards, concurrent `pf_start`
  locking, retention/collision policy in `backup-loop.sh`, restore argument
  terminator policy, and snapshot grammar handling — all remain
  needs-evidence in the D37-V10 verdicts.
- `stop.sh` cleanup-after-deletefailure adoption of the identity check is
  owned by the adjacent V09 package, not this change.
- Main specification synchronization; the coordinator owns that integration
  step.
