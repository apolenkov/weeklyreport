# Rethink the SDLC Pipeline Card: Product State vs. My Completeness (2026-06-13)

## Why

Live-walk feedback on the lead report SDLC pipeline card
(`lead/sdlc-pipeline.tsx:45`, the `rounded-xl` product card with a colored
left border). The user finds the current encoding wrong: the **left border
shows one overall state** (e.g. green) even when a per-stage chip is red
because a stage owner flagged a risk/blocker. One border conflated with
per-stage severity is confusing.

This connects to the already-shipped `unify-risk-stage-status` coupling and the
standing lesson that "a status hue on a row reads as the row's own severity".

## What Changes (user's desired model — DESIGN draft)

Separate two orthogonal signals that are currently muddled into the left
border:

1. **Left border = product health state.** It MUST reflect risk/blocker
   severity contributed by _any_ stage owner: if anyone responsible for a stage
   marked a risk or blocker, the left edge MUST surface that (at-risk / blocked),
   not stay green. (Build on `unify-risk-stage-status`.)

2. **Right side = "my part is complete" indicator.** A _distinct_ affordance
   (the user suggested a dashed / dotted outline) showing whether the
   responsible person has filled in all of their parts for this product —
   i.e. completeness of own input, NOT health. This is separate from health
   color so "is it healthy?" and "did I finish my entry?" read as two different
   questions.

The goal: a lead can tell at a glance (a) product health/severity from the
left, and (b) whether their own contribution is complete from the right.

## Single source of truth (status ⇆ risks)

Captured 2026-06-13 (extends, and partly SUPERSEDES, the already-archived
`unify-risk-stage-status`). The user wants the stage/product status and the
Risks section to be driven by **one source**, so the two can never disagree:

1. **One source drives the displayed status.** Adding a risk/blocker in the
   Risks section MUST immediately reflect on the stage chip and the left edge
   (and in the slide/preview) — no manual re-sync. "I added a red one below and
   nothing appeared above" must become impossible.
2. **The "unbacked stage" warning becomes obsolete.** Today a chip set to
   at-risk/blocked without a covering risk raises a warning. Under one source,
   status is _derived_ from risks, so that warning has nothing to warn about —
   remove it (don't keep a now-meaningless prompt).
3. **One-to-many, not one-to-one.** A stage may carry several risks/blockers.
   Many risks → many entries is fine; the card does not need one risk per stage.
4. **Severity priority: blocker > risk.** When a stage is covered by several
   risks, the **highest** severity wins for the derived status (blocker beats
   at-risk beats on-track). All covering risks are still shown; only the
   displayed status collapses to the top severity.

This is the "one source" the user keeps asking for. It builds on
`unify-risk-stage-status` (risks authored only in the Risks section) and turns
the chip status into a pure derivation of the covering risks, dropping the
prevention-warning half of that earlier change.

## Open Questions (DESIGN — resolve before implementing)

- What exactly counts as "my part complete" for a product? (all owned stages
  have a status set? required fields filled? risks addressed?)
- Right-side affordance: dashed outline, a checkmark, a progress pill? Pick one.
- Interaction with `unify-risk-stage-status`: the left border already has a
  severity source — confirm this only changes presentation, not the risk model.
- Does "completeness" apply per-product or per-stage?

## Out of Scope

- Theme / token / dark-mode work.
- Changing the risk authoring model (risks still live in the Risks section).

## Notes

- Capture draft from the 2026-06-13 live walk. Needs a design pass + a concrete
  spec before implementation; the delta under `specs/` records the direction,
  not a final contract.
