# Design

## Context

See proposal.md for the genuine command-boundary RED. The quick branch runs crawler then optional reset under set-e; full mode already owns EXIT/INT/TERM cleanup. The reset implementation and env.sh PID helper have other owners and are not modified here.

## Goals / Non-Goals

**Goals:** honor the existing explicit reset-after-walk promise without hiding either failure.

**Non-Goals:** prove database restoration by a reset invocation or change cancellation/stand policies.

## Decisions

Before: crawler nonzero → set-e exit → requested reset skipped. After: capture crawler exit → attempt only requested reset → disclose reset nonzero independently → return crawler exit when nonzero, otherwise reset exit.

Local exit capture makes the quick branch's ownership explicit. An unconditional global EXIT trap could reset unrequested quick runs or interfere with the full-mode trap; it is unnecessary. The external reset entrypoint remains the sole guard/database owner. No auth, report lifecycle tuple or destructive guard changes are made.

## Risks / Trade-offs

- A command attempt does not establish recovered data → Root owns full native guarded reset/browser acceptance.
- Background forward ownership remains separately unqualified → no new PID cleanup operation is added.

## Migration Plan

No configuration or schema migration. Ship quick flow and regression together; full cleanup behavior and other caller argv remain unchanged. Reverting restores the skipped requested reset.
