# Plan Review Log: fix-coming-soon-tooltip-clipping

Act 1 (grill-with-docs-codex, autonomous — user authorized self-grill and is
away) complete. Decisions locked from codebase exploration + best-practices
research (Radix Tooltip via Context7) + advisor blind-spot pass. CONTEXT.md
glossary updated ("Tooltip / hover affordance"). MAX_ROUNDS=5.

Act-1 note: the cross-model blind-spot consult was served by the `advisor`
reviewer (stronger model, full transcript) in place of a separate Act-1 Codex
thread, to avoid redundant proxy-hang-prone Codex calls; the formal cross-model
adversarial pass is Act 2 below.

## Round 1 — Codex (via codex:codex-rescue runtime; bare `codex exec` hung on quota)

VERDICT: REVISE. Findings touching this change:

- F1 — the MODIFIED deferred-feature-pattern delta dropped the "badges positioned identically across controls" invariant; restate it in Radix terms (same side/align/offset for all six).
- F2 — `admin-settings-ui` references the Holidays "Coming Soon tooltip"; migrating it to Radix needs an admin-settings-ui delta so the two specs stay consistent.
- F3 — the shared TooltipContent restyle also affects "+N more", stage chips, sidebar; verification covered only "+N more".
- F4 — the inert Holidays `<span>` is not keyboard-focusable inside its TabsTrigger, so a Radix TooltipTrigger on it opens on hover only; document the hover-only-visual contract (AT covered by the tab's accessible name).

### Claude's response (final arbiter): ACCEPT all four.

- F1 ACCEPTED — added positioning-consistency clause + scenario.
- F2 ACCEPTED — added `specs/admin-settings-ui/spec.md` MODIFIED delta + task.
- F3 ACCEPTED — verification expanded to all TooltipContent consumers; blast radius noted as intentional.
- F4 ACCEPTED — Holidays tooltip documented as hover-discoverable visual; coming-soon state reaches AT via the tab accessible name; added scenario + test.

## Round 2 — Codex

F1–F4 all RESOLVED; N1–N3 (new) NO FINDING. No further changes needed for this change.

## Round 3 — Codex

R1 RESOLVED (positioning identical). No new findings for this change; unchanged this round.

## Round 4 — Codex UNAVAILABLE (quota exhausted)

The Codex runtime returned a usage-limit error ("try again at 7:28 PM") — no
round-4 verdict could be obtained. The reviewing agent correctly returned no
verdict rather than fabricating one. (The separate stop-time Codex gate fails for
the same reason; it is not this review.)

## Resolution — Claude as final arbiter (converged, Codex round 4 deferred)

Disposition: CONVERGED on the builder side. Across 3 completed Codex rounds the
findings shrank monotonically — R1: 10 substantive; R2: 1 factual error + nits;
R3: 2 mechanism clarifications + doc nits — and EVERY finding was accepted and
applied (see rounds above). No finding is left open on my side. All four changes
pass `openspec validate --strict`.

This is NOT a faked APPROVED: Codex never emitted `VERDICT: APPROVED`; round 4
was blocked by Codex quota, not by an unresolved objection. A final round-4
confirmation pass can be run after the quota resets (~7:28 PM) or on credit
top-up if the user wants the explicit APPROVED line. The deliverable is sound and
ready for the user's apply/implement decision regardless.

## Round 5 — Independent verification (Claude agent team; Codex round-4 substitute, quota-blocked)

A 6-agent read-against-real-code pass (4 per-change verifiers + cross-coherence + completeness critic). For this change it caught what 3 Codex rounds missed:

- HIGH — the MODIFIED delta had RENAMED the requirement header, so OpenSpec (exact-header match) would NOT replace the live CSS-anchor requirement on archive/sync — leaving the spec self-contradictory (Radix portal AND retired CSS anchor). `--strict` passed because it checks delta structure, not header match. FIXED: rewrote the delta as REMOVED (exact live header) + ADDED (the portal requirement).
- HIGH — Radix Tooltip needs a `TooltipProvider` ancestor; agent-review mounts on many provider-less surfaces. FIXED: embed `TooltipProvider` inside the `ComingSoonTooltip` wrapper (self-contained), so the shell-enumeration is moot.
- MEDIUM — the shared `TooltipContent` restyle was a spec-orphan and brushes the repo "Visual And Theme Work" rule (research-only without a concrete user direction). FIXED: removed the restyle from this change; it is now a user decision (handoff). This change is a pure clipping/unification fix; ComingSoon uses its own chromeless amber content.
- LOW — arrow not parameterizable; design path wrong. FIXED in tasks/design.
  Re-validated `--strict` clean.

## Codex confirmation review (runtime, 2026-06-21, quota restored)

Codex was re-run over all five changes. Dispositions:

- This change: relevant verdict recorded in its own log.
- A category error to note: Codex graded the four prior changes as FAIL because
  the code / durable spec do NOT yet reflect them (no `ComingSoonTooltip` file,
  durable spec still has the old requirement, `useFullscreen` not hoisted, grid
  classes unchanged). That is the EXPECTED state of an un-applied OpenSpec change
  (all tasks `[ ]`, the grill-with-docs-codex skill stops at an approved change,
  before implementation). The delta artifacts themselves are correct — verified
  here: the REMOVED+ADDED header match (change A), the lead hook-ownership spec
  (change B), the floor-on-track `minmax` mechanism (change C1), the
  per-(product×section) advisory + `=5` (change C2). So Codex's REVISE reflects
  "not implemented yet", NOT a plan defect. add-slide-capacity-signals and
  fix-lead-product-grid-card-alignment got explicit PASS.
- Genuine actionable item applied: one residual contradictory heading in change
  C1 (`design.md` "bounded max-height") was reworded to match the no-literal-
  max-height mechanism.

Final-arbiter disposition: the five change PLANS are sound and ready to implement;
Codex's not-yet-implemented findings are expected and are the implementer's TODO
list (each change's tasks.md), not plan defects.
