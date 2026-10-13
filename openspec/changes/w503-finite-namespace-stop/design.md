# Design

## Context

See proposal.md for the C0095 defect and C0092 ownership. The current stop entry point already guards context/namespace, captures deletion status, and attempts all three forward cleanups after deletion failure. The missing bound prevents execution from reaching that cleanup when finalizers keep the namespace pending.

## Decisions

Add kubectl's native `--timeout=120s` to the existing `--wait=true` deletion. The duration follows `deploy/tester-kit/reset.sh`'s current pod deletion wait. A separate timeout process or environment knob adds no needed behavior.

Extend the existing executable stop test owner rather than add another harness. Record forwarded kubectl argv and assert a finite positive duration. Model kubectl timeout exit 1 through the same cleanup matrix as existing error exit 23, proving all cleanup attempts and deletion-status precedence. Keep guard and cancellation cases.

## Risks / Trade-offs

Timeout bounds kubectl's deletion-completion wait; it does not remove finalizers, cancel an accepted server-side deletion, or prove the namespace is gone. A namespace can remain Terminating after failure. A live cluster test is outside this package; the regression proves the real script delegates a finite wait and preserves cleanup/status behavior.

The period tuple, authorization builders, destructive database guard, Kubernetes target guard, and process identity helper are unchanged. No migration or new dependency is needed.
