# Tasks

## 1. Owned forward readiness

- [x] 1.1 RED: dead child, delayed owned listener, overlapping starts, stalled health request (TASK-503.15 C0065/C0102/C0068/C0089); C0057 scoped refusal controls (empty or key-truncated secrets.env refused before Kubernetes) — C0057 itself stays needs-evidence: no producer interruption evidence.
- [x] 1.2 `pf_start` waits for its own listener under a per-name `mkdir` lock; `start.sh` curl `--max-time 5` (no `--connect-timeout`).
- [x] 1.3 Reuse path: an existing owned record is reused only for the requested target while its own process listens; a mismatched or silent owned record is replaced.

## 2. Verification and delivery

- [ ] 2.1 GREEN, six gates on the reviewed tree and independent review.
