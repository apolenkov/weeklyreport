# PARKED — versions-v2-restore-fidelity

Deferred 2026-06-15 (versioning stays ComingSoon; revisit separately). Moved out
of `openspec/changes/` so it does not appear in `openspec list`.

This folder is the COMPLETE design package:

- `proposal.md` — narrowed owned-content invariant.
- `design.md` — the Codex-approved design (3 adversarial rounds, APPROVED).
- `tasks.md` — includes the R1-R10 supervised-finish checklist + review findings.

The REVIEWED BACKEND CODE (snapshot capture, guarded restore writer with
updatedAt CAS, the real ExactDeep drift guard, the round-trip contract tests —
all green and reviewed by 2 Opus lenses) is NOT in this folder (it is code, not
spec). It is recoverable from the closed **PR #12** diff on GitHub and the
`feat/overnight-backlog-2026-06-14` branch. To revive: move this folder back to
`openspec/changes/`, cherry-pick the backend commits from that branch, then
resume at R1 (the server-side ownership gate) per `tasks.md`.
