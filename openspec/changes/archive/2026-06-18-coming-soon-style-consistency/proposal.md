# Keep every "Coming Soon" affordance on one canonical style

## Why

User feedback (live demo, 2026-06-18): hovering the Agent-review control should
show the same "Coming Soon" treatment as the other deferred-feature icons — "так
же, как у других иконочек, чтобы было всё одинаково в стиле."

**Investigation finding (the visual ask is already satisfied):** every Coming
Soon affordance already renders the single shared `ComingSoonBadge`
(`packages/ui/src/components/coming-soon-badge.tsx`, amber `bg-amber-100` /
`text-amber-700`). There is no red/yellow variant and no second style anywhere.
Verified live in the running app: all five on-screen badges (Agent review,
Language, Theme, Version, PDF export) compute to one identical pair —
`background oklch(0.962 0.059 95.617)`, `color oklch(0.555 0.163 48.998)`. Agent
review is byte-identical to the others; nothing about its color needs changing.

So this change does **not** restyle anything. It codifies "one Coming Soon
style" as a testable invariant so the uniformity the user wants can never
silently drift:

1. All deferred affordances route through the shared `ComingSoonBadge`; no
   bespoke badge or second color variant.
2. The deferred state stays announced to assistive tech (regression guard).

**Correction to the original premise (implementation finding):** the first draft
claimed `HolidaysComingSoonControl` was "missing an `aria-label`" and treated it
as a drift to fix. That is wrong. The `verify-a11y-recommended-flip` change
(archived `2026-06-10`) **deliberately removed** that exact aria-label
(`'Holidays calendar is coming soon'`) as redundant on an inert span, and pinned
its absence with a regression test. The Holidays control is an inert `<span>`
inside the holidays `TabsTrigger` (a `<button>`), so — unlike the standalone
focusable Agent-review `<button>`, where `aria-label` is the correct name source
— re-adding `aria-label` to the inner span would pollute the tab button's
accessible-name computation. Empirically the deferred state is **already
announced**: the badge's "Coming Soon" text is a descendant of the tab button, so
the tab's computed accessible name already contains "Coming Soon" (verified via
the accessible-name algorithm in test). There is no a11y gap, so this change adds
no aria-label; it adds a regression test pinning that the announced state holds.

## What Changes

- Add a regression guard (test) asserting that every rendered Coming Soon badge
  resolves to the same canonical style and that no component hand-rolls a
  "Coming Soon" pill outside `ComingSoonBadge`.
- Add a regression test pinning that the Holidays deferred control's coming-soon
  state remains in the holidays tab's computed accessible name (the badge-in-
  button mechanism), so the `2026-06-10` decision cannot silently regress.
- **No aria-label change** — re-adding it would revert a settled a11y decision
  and is the wrong mechanism for an inert span (see correction above).

## Out of scope

- Any color/visual restyle of Agent review or any other badge — they are already
  identical; no change.
- **Optional, NOT queued (needs explicit go-ahead):** extracting the duplicated
  Family-1 wrapper (`group relative inline-flex` + inert host + positioned
  badge, copy-pasted across ~6 controls) into one shared `ComingSoonControl`
  primitive. It would prevent future drift but is a refactor of working code the
  user did not request — left as a documented follow-up, not part of this change.
- The always-visible integration-card badges (`settings-integrations-sub-tab`),
  which already use the default `ComingSoonBadge` and are status labels, not
  hover controls.

## Impact

- Affected specs: ADDED requirement under `deferred-feature-pattern` (single
  canonical badge style is guarded; deferred state stays announced to AT).
- Affected code: **no production code change.** New regression tests only (one
  canonical style + no-bespoke-pill guard + holidays announced-state pin). No
  visual change to any existing badge; no aria-label change.
