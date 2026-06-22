# Fix the Coming-Soon tooltip that never appears on clipped controls

## Why

On `/lead/report`, hovering the **Agent review** Coming-Soon control shows
nothing — no tooltip at all (live lead feedback, 2026-06-20: "я навожу, ничего
не появляется"). The same dead hover hits the admin **Holidays** control. Both
sit inside an `overflow-x-auto` ancestor (the report toolbar row and the admin
`TabsList`), and the Coming-Soon affordance is a CSS `group-hover` amber badge
positioned _below_ the control — so `overflow-y` computes to `auto` and clips
the badge. The recent change `polish-decision-owner-and-comingsoon-tooltip`
removed the native `title="Coming Soon"` (to kill a double-tooltip), which
removed the only thing that still showed on these two clipped controls.

The lead also asked why this isn't "the same Coming-Soon as the dark-theme
control" and whether tooltips run "through one ready tool". The dark-theme/nav
controls work because their parent is not an overflow container; the toolbar
ones do not. The fix is to stop relying on a CSS overlay that any overflow
ancestor can clip.

## What Changes

Migrate the six tooltip-anchored Coming-Soon controls (agent-review, lead
version, lead PDF-export, nav theme, nav language, admin holidays) from the CSS
`group-hover` `ComingSoonBadge` + `COMING_SOON_TOOLTIP_ANCHOR` overlay to the
existing Radix Tooltip primitive (`packages/ui/.../ui/tooltip.tsx`). Radix
renders tooltip content in a **Portal**, which escapes any `overflow` ancestor —
the same reason the SDLC stage-chip tooltip already portals to `body`. The
visible label stays the canonical amber `ComingSoonBadge` (the
deferred-feature-pattern spec forbids a second colour variant).

## Non-goals

- **The "+N more" tooltip restyle is NOT in this change.** The lead's "сделать
  красивее, не белый на чёрном" is a direction, not a concrete token choice, and
  the shared `TooltipContent` it would restyle is also used by the SDLC stage
  chips and the sidebar (broad blast radius). Per the repo's "Visual And Theme
  Work" rule (research-only until the user picks a concrete direction), it is
  surfaced as a user decision in the handoff, not specced here. This change keeps
  ComingSoon on a chromeless amber surface (its own wrapper content), and leaves
  the shared dark `TooltipContent` untouched.

- The separate `sdlc-tooltip.tsx` custom `createPortal` system stays as-is — it
  solves a different accordion-`overflow:hidden` case. After this change there
  are still two portal tooltip systems, not one.
- The 4 inline admin integration-row `ComingSoonBadge`s are static labels, not
  tooltips — out of scope.
- No DB / API / shared-schema change.

## Capabilities

- `deferred-feature-pattern` — REMOVED the CSS-anchor requirement + ADDED the
  Radix-portal requirement: Coming-Soon tooltips render through the shared Radix
  Tooltip (portal), not a clip-prone CSS overlay; positioned identically across
  all six controls.
- `admin-settings-ui` — MODIFIED: the Holidays coming-soon control's tooltip is
  the shared Radix tooltip (hover-discoverable), still inert with no nested
  interactive element and its coming-soon state in the tab's accessible name.
