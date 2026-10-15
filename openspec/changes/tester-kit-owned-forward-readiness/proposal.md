## Why

`pf_start` (`deploy/tester-kit/env.sh`) returned as soon as it spawned a background
`kubectl port-forward`, so `walk.sh` could start the crawler while the forward had already
died (C0065/C0102). Two overlapping calls could both pass the check and start two forwards,
losing one PID so `pf_stop` left a forward running (C0068). The readiness loop in `start.sh`
used `curl` without a per-request timeout, so one stalled request could hang the start
(C0089). Fixtures under TASK-503.15 reproduced all three.

## What Changes

- `pf_start` returns only after its own child listens on the local port
  (`lsof -a -p <child>`); a dead or never-listening child is stopped, its pidfile is not
  written, and the log path is reported.
- Check and start run under a per-name `mkdir` lock released by a subshell `EXIT` trap; a
  second caller waits, then reuses the owned forward.
- An existing owned record is reused only when it carries the requested service and ports and
  its own process listens on the local port; a mismatched or never-listening owned record is
  stopped (the PID is proven ours) and replaced. A foreign process is never signalled.
- `start.sh` health requests use `curl --max-time 5` (no separate connect timeout); the final
  readiness probe stays. Worst case of the 60-iteration loop is about 60×(5+2)+5 ≈ 425 s.

## Impact

- `deploy/tester-kit/env.sh`, `deploy/tester-kit/start.sh` and their fixture tests.
- Tester stand only. `reset.sh` keeps its own forwards (F136-2 remains native-only).
