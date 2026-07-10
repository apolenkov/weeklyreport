# Design — unify-web-status-color-tokens

## Context

The 2026-06-10 palette work replaced the "parrot" status surface with a token
system, and `status-color-semantics` fixes the invariant: status color comes from
named tokens, one alarm hue (red = blocked), amber only as the at-risk accent. A
grep of `apps/web/src` shows ~10 report-workflow status callsites still painting
at-risk/blocked with raw hex, plus one dead `var(--color-success,#16a34a)` fallback.
Roadmap #3 (`unify-status-presentation`) will reshape status presentation in one
place; it must read a token contract, not chase scattered literals. This change
(#38) is that prerequisite token layer.

## Goals / Non-Goals

**Goals**

- Every report-workflow status color the web renders resolves through a named token.
- No `var(--color-…, #hex)` fallback survives in web src.
- Add `--color-border-subtle` for the hairline #3's status cards use.

**Non-Goals**

- No repo-wide border sweep. `--color-border-subtle` is defined and adopted only by
  the in-scope status surfaces (and #3); the ~100 neutral `rgba(0,0,0,0.0x)` borders
  elsewhere are untouched.
- No recolor of the non-status domains (role badges, period lifecycle, print).
- No new status presentation behavior — that is #3.

## Decisions

### D1 — New capability, ADDED-only, not a MODIFIED of status-color-semantics

`status-color-semantics` owns the semantic invariant ("no literals", one alarm hue,
sign-off gate). This change operationalizes it on the holdout surfaces and adds one
token. Framing it as a new `web-status-color-tokens` capability with ADDED
requirements keeps the invariant untouched, avoids restating it (which would read as
duplicate specs), and carries zero header-collision risk with in-flight changes.

`unify-status-presentation` (#3) is NOT a stub: it carries a full
`status-presentation-model/spec.md`. That spec is ADDED-only on a different
capability (`status-presentation-model`), so no delta header collides with this
change's `web-status-color-tokens`. But #3 does impose an **ordering constraint**
this side must record. #3's "Consolidation preserves rendered output parity per
status" requirement mandates "the token each status resolves to is unchanged" and
"no color literal is added, removed, or moved between surfaces" — and #3 names
`blocked-at-risk-product-card` (and other surfaces) as consumers of its canonical
map. If #3 lands before #38 consolidates `#8a6d1b` on those surfaces, #3's parity
requirement freezes the raw hex in place. Therefore: **#38's foreground
consolidation MUST be complete on every surface #3 consumes before #3 lands.**

### D2 — Scope by semantic domain, not by hex value

The same amber/red hex appears in unrelated domains. The discriminator is the
`status-color-semantics` invariant "amber = at-risk, red = blocked": a same-hex use
that is NOT report-workflow status cannot become a `--color-status-*` token.

- **IN** (genuine report-workflow status): `risk-card`, `risk-edit-dialog`,
  `portfolio-overview-table`, `lead-form` (blocked accent), `lead-history-list` /
  `lead-history-sidebar`, `meta-row` / `item-card-stage-tags` (stage-hint amber).
- **OUT**: `users-tab` role badge (`#fef3c7/#92400e` keyed by ROLE name — folding it
  into at-risk would drag the admin badge on any future at-risk shift); `periods-tab-*`
  reopened tag / progress tone / required-asterisk `#991b1b` and delete-confirm red
  (period-lifecycle, form-validation, destructive-action — separate status domains);
  `publish-lock-button` pending-leads warning (`#8a6d1b`/`#fffbeb`) and `decision-card`
  "Due" deadline chip (`#8a6d1b`/`#fff7e6`) — both reuse the amber palette but signal a
  warning / an approaching deadline, NOT report-workflow at-risk status, so by the D2
  discriminator ("amber = at-risk") they stay literal, mirroring the stage-hint sign-off
  question rather than folding into `--color-status-at-risk-*`; `print-report-template`
  (PDF renderer cannot resolve CSS custom properties, so inline hex is required there —
  this is a technical constraint, not an oversight).

### D3 — Consolidate near-duplicate foregrounds, gate on sign-off

Report surfaces paint the at-risk foreground with a single raw amber, `#8a6d1b`,
repeated across the in-scope surfaces with no matching token. (The blocked
foreground on report surfaces already resolves `--color-destructive` — see
`risk-card`, `portfolio-overview-table` — so there is no blocked-foreground
consolidation to do. The `#92400e` / `#991b1b` literals the earlier grep surfaced
live only in the out-of-scope admin domain, so they are not touched here.) For the
`#8a6d1b` at-risk foreground, two options:

- **(a) Add an exact-value token** — zero visual delta, but enshrines a second amber
  for the same semantic, which the exemplary "one token per semantic" goal rejects.
- **(b) Consolidate** onto the existing `--color-status-at-risk-fg` (#78350f) — one
  canonical value, small pixel shift.

**Chosen: (b).** The brief says "use the existing variables", and one canonical
at-risk-fg is the correct end state. Consolidation is a palette change, so it ships
under `status-color-semantics` "Palette changes ship only with recorded sign-off and
visual acceptance" — tasks.md carries the cite-sign-off + before/after-screenshot steps.

### D4 — `save-now-button` is a semantic fix, not a mechanical strip

`var(--color-success,#16a34a)` — `--color-success` IS defined (#d8ece4 pale mint, same
as `--color-chip-on-track-bg`), so the `#16a34a` fallback is already dead and the
checkmark stroke currently resolves to pale mint. Stripping to `var(--color-success)`
would lock that in. A "saved" checkmark wants the green foreground; point the stroke
at `--color-success-foreground` (#006241). `--color-primary` is the rejected
alternative — it is the brand green, not the success-state green, and pinning the
token contract to one value keeps the acceptance scenario unambiguous.

### D5 — `--color-border-subtle` value

Dominant subtle hairline is `rgba(0,0,0,0.08)` (card dividers). Define
`--color-border-subtle` at `rgba(0,0,0,0.08)`. Only the in-scope surfaces that
already draw an exact `rgba(0,0,0,0.08)` hairline adopt the token — a zero-delta
swap. The `rgba(0,0,0,0.07)` (e.g. `lead-history-list` inner divider) and
`rgba(0,0,0,0.10)` (e.g. `lead-history-list` / `portfolio-overview-table` card
frame) variants on those same surfaces are DEFERRED: folding them onto 0.08 would
shift pixels outside the D3 sign-off list, and 0.10 does not even match a `0.0x`
hairline. A later change can normalize them under their own visual sign-off.

## Risks / Trade-offs

- **Visual drift on consolidated foregrounds (D3).** Mitigation: before/after
  screenshots + sign-off gate before archive; the shift is confined to at-risk/blocked
  text, not fills.
- **Stage-hint amber semantics (meta-row / item-card-stage-tags).** The "needs stage"
  hint uses the at-risk amber palette but is a data-quality anomaly, not at-risk.
  Routing it to `--color-status-at-risk-*` matches current pixels; whether it should
  instead read a warning token is a sign-off question, flagged in tasks.
- **Under-scoping OUT domains.** Role/period/print reds stay literal for now; a future
  change may give them their own named tokens. Called out so it is a deliberate defer,
  not a miss.

## Migration

Pure front-end token rewire. No data, schema, or API change. Ships behind the
`status-color-semantics` visual-acceptance gate; revert is a git revert of the token +
callsite edits.
