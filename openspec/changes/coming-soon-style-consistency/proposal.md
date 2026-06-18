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

So this change does **not** restyle anything. It does two small, durable things
so the uniformity the user wants can never silently drift, plus fixes the one
real inconsistency the audit surfaced:

1. Codify "one Coming Soon style" as a testable invariant (all deferred
   affordances route through the shared `ComingSoonBadge`; no bespoke badge).
2. Fix the single accessibility drift: `HolidaysComingSoonControl`
   (`apps/web/src/components/admin/settings-tab.tsx`) is the only Family-1
   control missing an `aria-label` — it has only `title="Coming Soon"`.

## What Changes

- Add a regression guard (test) asserting that every rendered Coming Soon badge
  resolves to the same canonical style and that no component hand-rolls a
  "Coming Soon" pill outside `ComingSoonBadge`.
- Give `HolidaysComingSoonControl` an `aria-label` ("Holiday management is coming
  soon"), matching the other deferred controls' accessible-name convention.

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

- Affected specs: ADDED requirements under `deferred-feature-pattern` (single
  canonical badge style is guarded; deferred controls carry an accessible name).
- Affected code: `apps/web/src/components/admin/settings-tab.tsx`
  (`HolidaysComingSoonControl` aria-label) + a new regression test. No visual
  change to any existing badge.
