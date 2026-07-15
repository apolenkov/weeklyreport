# 5. Head dashboard gets a light-framed "Team Pulse" forest hero with a submission-rhythm chart

Date: 2026-06-24

## Status

Accepted (design direction only — implementation deferred, see Consequences).

## Context

The head `/head/dashboard` read "flat and dry": a faint cream canvas plus hard
`#ccd4c8` card borders made the panels look like boxes cut out and floating in
emptiness, with zero data visualisation. The repo keeps background/theme work
research-only until the user explicitly picks a concrete direction, so the
direction was pinned through a grilling session with rendered HTML mockups
(preserved in `~/work/customreport-stash-archive/head-dashboard-*-2026-06-24.html`,
switchable via `?v=` / `?opt=` / `?band=`) reviewed by three independent lenses
(frontend-design, Web Interface Guidelines, the author).

The exploration converged through several reversals worth recording so a future
reader does not re-walk them:

- A dark forest "hero band" (the landing `pulse-bg` language brought into the
  app) carrying a 6-week "submission rhythm" sparkline tested best with the user
  ("the dashboard becomes a dashboard").
- An all-light "cockpit" alternative was briefly chosen as the safer,
  identity-pure option, but the user came back to the hero direction.
- The hero's first dark tone (`#11302a`) was rejected as "too dark." Lightening
  the band toward a mid-green (`#3f7a66`) was then rejected by the design review:
  that green reads as a "healthy / on-track" status fill — a false-positive a
  traffic-light tool must avoid. The fix for "too dark" was air, not
  desaturation.

## Decision

The head dashboard is enriched, keeping the warm cream Starbucks identity:

- **Warm background atmosphere** — a soft glow + faint dot grid over the cream
  canvas, carrying no hue that could read as a traffic-light status.
- **Soft borderless panels** — near-invisible border + soft shadow instead of
  the hard `#ccd4c8` 1px rule; depth via elevation, not outline.
- **A "Team Pulse" hero band** under the title, in **forest `#2d4f47`** — which
  is the existing `--color-sidebar-accent` token, so it reads as established
  brand chrome, not as a status fill. It is **light-framed**: generous internal
  padding and a small inset so the cream canvas frames it, which removes the
  "too dark / heavy slab" feel without lightening the band into status-green
  territory. It carries the eyebrow + product title + deadline countdown (left)
  and the submission-rhythm chart (right), in white/cream text (≈9:1 contrast).
- **Risk proportion bar** kept, with the review fixes: proportional segment
  widths, and the neutral "Decisions" count recoloured off status-green so the
  bar does not read as a red→amber→green severity scale.

Rejected: the all-light cockpit (the user preferred the hero), the near-black
band (`#11302a`, too dark), the mid-green band (`#3f7a66`, collides with
on-track status green), and the editorial/serif direction (changed the
identity).

## Consequences

- The visual treatment (atmosphere, soft panels, forest hero frame, risk-bar
  fixes) is presentation-only and can ship on existing data.
- **The 6-week submission-rhythm chart is part of the design but is a feature,
  not CSS.** No query returns historical submitted/total per period today (the
  dashboard exposes only the current period's `submissionCount`/`totalLeads`
  plus a "last week" figure). It needs a new backend aggregate over the last ~6
  reporting periods, and it must render the in-progress current week honestly —
  completed weeks only, or the current week as a hollow/projected marker, never
  a solid terminal point (a solid mid-week point always dips down and reads
  "submissions collapsing"). Until that exists, the hero can ship without the
  chart (or with an empty state); the chart lands when the aggregate does.
- Implementation is deferred per the user ("пока не надо реализовывать"). When
  built, the Web Interface Guidelines must-dos apply: informational SVGs (ring,
  rhythm chart) need a text equivalent (`role="img"` + `aria-label`, already in
  the mockup) — never status by colour alone; `tabular-nums` on every numeric
  field; `focus-visible` rings on all controls; real `<button>`/`<Link>` (not
  `<div onClick>`); a section heading wrapping the hero/stats; dates via
  `Intl.DateTimeFormat`.
- Reversible at the cost of re-running this review; this ADR records why the
  lighter greens and the near-black were both rejected so the forest+air choice
  is not later "corrected" in either direction.
