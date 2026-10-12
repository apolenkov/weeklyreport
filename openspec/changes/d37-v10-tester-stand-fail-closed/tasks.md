# Tasks

## 1. Tester stand fail-closed corrections

- [x] 1.1 Separate the first-start `User` count probe status from its output: keep stderr visible, exit non-zero on probe failure, and reset only on a successful count of `0`; proven RED→GREEN by the focused gate test.
- [x] 1.2 Move `--registry` credentials off child argv into a private 0600 `dockerconfigjson` file applied via `--from-file`, with cleanup on every exit; proven RED→GREEN by the focused gate test (fixture secret absent from all recorded child argv, manifest still applied).
- [x] 1.3 Expand an empty `PULL_ARGS` with the `[@]+` idiom used by `walk.sh`/`full-run.sh`, fixing the `set -u` abort on the stock `/bin/bash` 3.2.
- [x] 1.4 Serialize the dockerconfig file with Node `JSON.stringify` fed by the inherited environment (no secret literal in the serializer argv), so JSON control characters in credentials cannot corrupt the `--from-file` document; RED shown by `JSON.parse` failing at the stubbed kubectl file boundary, GREEN by round-tripped credentials and removed temp file.
- [x] 1.5 Record forward identity (PID + start time + forward target) in `pf_start` and verify it in `pf_stop`/`pf_owned`: a stale live PID is not accepted as a running forward, a mismatched or old-format pidfile is never signalled, and an identity-matching recorded forward is stopped; proven with disposable child-process fixtures, no real Kubernetes.

## 2. Scoped integration and handoff

- [x] 2.1 Run the focused gate test under the coordinator's lockf/timeout policy, changed-file Prettier/ESLint, `git diff --check`, and `openspec validate --strict`; preserve actual commands/exits in D37-V10 evidence.
- [ ] 2.2 Pending (V09-owned): `stop.sh` cleanup-after-deletefailure adopts the `pf_owned`/`pf_stop` identity check; signature is unchanged so adoption needs no further env.sh change.
- [ ] 2.3 Pending (needs-evidence): port-forward readiness probing, concurrent `pf_start` locking and any broader process-matching beyond recorded identity — C0065/C0068 stay open.
- [ ] 2.4 Coordinator: synchronize main specs, integrate with normal hooks, and run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` plus independent aggregate final review on the integrated tree.
