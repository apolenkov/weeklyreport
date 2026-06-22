# Plan Review Log: add-slide-capacity-signals

Act 1 (grill-with-docs-codex, autonomous — user away) complete. Decisions locked
from codebase exploration (no per-lead / per-section limit exists today; Project
leadId model) + advisor blind-spot pass.

Key advisor correction APPLIED: keep both signals ADVISORY ONLY — no schema, no
Zod, no server reject. The "6" is the lead's stated approximate number, recorded
as a tunable constant and flagged for his confirmation. MAX_ROUNDS=5.

Act-1 cross-model blind-spot role served by `advisor`; formal Codex adversarial
review is Act 2 below.

## Round 1 — Codex (via codex:codex-rescue runtime)

VERDICT: REVISE. Findings touching this change:

- F8 — the per-lead product count must come from the FULL products set, not `filteredProducts` (narrowed by the product filter + local search → undercount).
- F9 — `SLIDE_SECTION_SOFT_CAP` left as "~5-6" is non-deterministic / untestable; pin a concrete default.
- F10 — uses "limit" vs the canonical CONTEXT.md "soft cap" / "capacity signal".

### Claude's response (final arbiter): ACCEPT all three.

- F8 ACCEPTED — count derives from the full `products` prop per `leadOwnerId` (active only), independent of filter/search state; added test.
- F9 ACCEPTED — pinned `SLIDE_SECTION_SOFT_CAP = 5` (concrete, tunable).
- F10 ACCEPTED — terminology scrubbed to "soft cap" / "capacity signal" except where contrasting with a hard limit.

## Round 2 — Codex

F8 RESOLVED. F9/F10 PARTIAL + new N6: the concrete value `5` and the canonical "soft cap" wording landed in design/tasks but not in the NORMATIVE spec line / proposal.

### Claude's response (final arbiter): ACCEPT.

- F9/N6 ACCEPTED — added "value 5" to the normative `SLIDE_SECTION_SOFT_CAP` requirement line.
- F10 ACCEPTED — reworded proposal "per-lead/per-section limit" → "ceiling (neither advisory nor enforced)".

## Round 3 — Codex

V3 RESOLVED (value 5 in normative spec). V4 PARTIAL + X5: residual "limit" in capacity context (proposal, tasks, spec) vs CONTEXT.md's avoid-"limit" guidance.

### Claude's response (final arbiter): ACCEPT.

- X5 ACCEPTED — scrubbed remaining "limit" to "soft cap" / "hard enforced rule" / "enforcement" across proposal, tasks, spec, and design (contrast uses reworded too).

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

- MEDIUM — the sections are NOT per-product: each receives the whole cross-product list and groups internally, with one section-level Add control, so "a product's count near the Add control" was under-specified. FIXED: the advisory unit is per-(product × section), attached to the affected product GROUP within the section (matches the slide's per-product quadrant); spec/design/tasks updated; the four real section files named (current/next-week-section, risks-section, decisions-section — not lead-form).
- MEDIUM (coherence) — C2 spec over-committed "scroll-reachable per lead-slide-quadrants" while C1 leaves the direction open. FIXED: softened to "intended to degrade gracefully; advisory wording pending the C1 direction"; added the reciprocal cross-link in C1.
- LOW — proposal missing `SLIDE_SECTION_SOFT_CAP = 5`; task 5.2 said ADD a glossary entry that already exists. FIXED (value added; task reframed to verify).
  All advisory-only claims confirmed (no schema/Zod/server). Re-validated `--strict` clean.

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
