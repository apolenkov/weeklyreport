# Plan Review Log: add-slide-fullscreen-exit-affordance

Act 1 (grill-with-docs-codex, autonomous — user away) complete. Decisions locked
from codebase exploration (native Fullscreen API; floating exit pill exists but
mounted only on the head deck) + best-practices research (MDN Fullscreen API,
web.dev, caniuse) + advisor blind-spot pass. MAX_ROUNDS=5.

Act-1 cross-model blind-spot role served by `advisor`; formal Codex adversarial
review is Act 2 below.

## Round 1 — Codex (via codex:codex-rescue runtime)

VERDICT: REVISE. Findings touching this change:

- F5 — `SlideFullscreenButton` registers a document-wide `f` keydown handler; mounting a SECOND instance (the floating pill on the lead deck) creates a second listener → double toggle. (Note: the head deck already mounts both default + floating, so this double-listener likely pre-exists there.)
- F6 — the floating pill returns `null` when not fullscreen, so a focus-return targeting it after exit targets a vanishing element.

### Claude's response (final arbiter): ACCEPT both.

- F5 ACCEPTED — the global `f` keydown must have a single owner; the floating variant registers no keydown. Flagged the likely pre-existing head double-listener for the same fix.
- F6 ACCEPTED — focus returns to the PERSISTENT toolbar toggle (the enter affordance), never the unmounting floating pill; verify Esc-exit and pill-exit both.

## Round 2 — Codex

F5/F6 PARTIAL + new N4/N7: my Round-1 premise was factually wrong. Real code (verified): the head deck mounts ONLY the floating pill (no default toggle); the lead deck has the persistent default toggle. The `f` keydown lives in EVERY button instance's effect and runs even when floating renders null — so each deck has exactly one `f` owner today (lead=default, head=floating). A per-variant "floating never registers f" guard would strip `f` from head entirely (it has no other instance and no visible enter button).

### Claude's response (final arbiter): ACCEPT — corrected approach.

- Corrected the design's factual error about the head deck.
- F5/N4 ACCEPTED — hoist the `f` shortcut + `fullscreenchange` into a single deck-level `useFullscreen(targetRef)` hook (always mounted, one owner per deck); make `SlideFullscreenButton` presentational. Lead's added floating pill no longer double-toggles; head keeps its single `f` owner.
- F6/N7 ACCEPTED — focus returns to a STABLE per-deck target (lead toolbar toggle; head deck article/heading), never the unmounting floating pill. Spec softened from "the toolbar toggle" to "a stable control on the deck".
- Head's `f`-only ENTER affordance noted as a pre-existing, out-of-scope gap.

## Round 3 — Codex

V1 PARTIAL + new X2: the head-deck focus-return target ("article/heading") is not a focusable element (plain `<article>`/`<h2>`).

### Claude's response (final arbiter): ACCEPT.

- X2 ACCEPTED — head focus target is the deck article made programmatically focusable (`tabIndex={-1}` on `HeadSlideArticle` + `.focus()`). Spec/design/task updated.

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

## Round 5 — Independent verification (Claude agent team)

- HIGH — the lead's fullscreen controls are split across two components (lead-form toolbar toggle + LeadSlidesClient floating pill) sharing only `deckRef`, not state; the "one useFullscreen owner per deck" plan never said WHO owns it per topology, risking either two keydown listeners or a button that never renders. FIXED: design + task 1.4 make ownership explicit (lead-form owns the hook and threads isFullscreen/onToggle into both its toggle and LeadSlidesClient; standalone LeadSlidesClient owns its own), with an acceptance check for exactly one keydown listener.
- LOW — "double toggle cancels out" rationale imprecise. FIXED: reworded to "duplicate/competing handlers + split state source".
  All factual claims about the code confirmed (native API; f-listener in every instance's effect; head=floating-only; lead=default toggle; no aria-pressed/focus-return today; tabIndex={-1} is a valid focus target). Re-validated `--strict` clean.

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
