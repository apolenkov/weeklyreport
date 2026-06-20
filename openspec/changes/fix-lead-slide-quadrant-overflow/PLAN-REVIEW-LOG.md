# Plan Review Log: fix-lead-slide-quadrant-overflow

Act 1 (grill-with-docs-codex, autonomous — user away) complete. Decisions locked
from codebase exploration (the clip chain in `lead-unified-slide.tsx`) +
best-practices research (`R-overflow`: density tiers + continuation slides) +
advisor blind-spot pass.

Key advisor correction APPLIED: do NOT autonomously lock an overflow strategy
that reverses the 2026-06-10 user-signed-off equal-quadrant design. This change
encodes ONLY the minimal data-loss fix (scroll-reachable overflow). The
"fit/split" UX the lead asked for (taller frame / continuation slides) is
surfaced in `design.md` as the lead's decision, not encoded in the spec delta.
MAX_ROUNDS=5.

Act-1 cross-model blind-spot role served by `advisor`; formal Codex adversarial
review is Act 2 below.

## Round 1 — Codex (via codex:codex-rescue runtime)

VERDICT: REVISE. Finding touching this change:

- F7 — encoding only scroll while leaving "visually equal framed zones" / "fills its frame" without a checkable max-height binding; tie the max-height to the equal zone, or block until fit/split is chosen.

### Claude's response (final arbiter): ACCEPT (sharpen), do NOT block.

- F7 ACCEPTED-sharpen — the requirement now states the quadrant `max-height` is bounded BY its equal `auto-rows-fr` zone, so equal-zones + fills-frame are preserved AND overflow is scroll-reachable (checkable). NOT blocked: the scroll baseline is the deliberate data-loss fix; the fit/split fork stays the user's decision (advisor direction), recorded in design.md, not encoded here.

## Round 2 — Codex

F7 RESOLVED. New N5: the "finite max-height equal to the zone" wording was prose with no implementable CSS mechanism (the row height comes from the `auto-rows-fr` track, not a literal max-height).

### Claude's response (final arbiter): ACCEPT.

- N5 ACCEPTED — reworded spec + design to the concrete mechanism: `overflow-y:auto` + `min-h-0` on the card so it scrolls WITHIN its `auto-rows-fr` row instead of expanding it (no literal max-height); reconcile the `--slide-quadrant-min` sparse floor with `min-h-0` dense-shrink; verify live (jsdom cannot measure layout).

## Round 3 — Codex

V2 PARTIAL + new X3/X6: (X3) `min-h-0` and the `--slide-quadrant-min` floor cannot both sit on the card's `min-height`; the coexistence mechanism was undefined. (X6/V2) residual "finite max-height" wording lingered in proposal + design test-strategy + a task while design said "no literal max-height".

### Claude's response (final arbiter): ACCEPT.

- X3 ACCEPTED — move the floor OFF the card and onto the grid TRACK: `grid-auto-rows: minmax(var(--slide-quadrant-min), 1fr)`; card keeps `min-h-0` + `overflow-y-auto`. No property collision. Spec/design/task updated.
- X6/V2 ACCEPTED — scrubbed "finite max-height" from proposal, design fork-table + test-strategy, and tasks; reframed around row-containment + min-h-0 + live verification.

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

## Round 5 — Independent verification (Claude agent team): verdict SOUND

The per-change verifier returned verdict=sound: every factual claim confirmed against the code, the CSS mechanism (`overflow-y:auto` + `min-h-0` on the card; floor moved to the grid track via `minmax(var(--slide-quadrant-min), 1fr)`) is sound, the print/PDF path is genuinely separate (no PDF regression), and the scroll-only baseline (deferring fit/split to the user) is the correct autonomous disposition. Two non-blocking nits applied: (1) the jsdom "every row present" assertion can't discriminate the bug (rows are always in the DOM under overflow:hidden) — test reworded to rely on class assertions + live height check; (2) a spec-hygiene note reconciling the untouched "fills its frame" requirement with the floor-on-track mechanism. Re-validated `--strict` clean.

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
