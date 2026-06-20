# Design

## Context

Three hover-affordance systems coexist today (verified by codebase exploration):

1. **Radix Tooltip** (`packages/ui/src/components/ui/tooltip.tsx`) — true
   `TooltipPrimitive.Portal`; dark `bg-foreground`/`text-background` style.
   Consumers: the "+N more" SDLC collapsed indicator, SDLC stage chips, sidebar.
2. **Custom `createPortal` tooltip** (`apps/web/src/components/ui/sdlc-tooltip.tsx`)
   — a singleton `#sdlc-tip` portaled to `document.body` for stage-chip hovers,
   to escape an accordion's `overflow:hidden`. NOT Radix.
3. **Coming-Soon CSS overlay** — a `<ComingSoonBadge role="tooltip">` revealed by
   `group-hover` and positioned by the shared `COMING_SOON_TOOLTIP_ANCHOR`
   (`top-[calc(100%+6px)]`, below the control). Used by all six deferred controls.

System 3 is the bug surface. The amber badge sits below the control; per CSS
Overflow L3, when an ancestor sets `overflow-x: auto` the `overflow-y` computes
to `auto` (not `visible`), so the below-anchored badge is clipped. Two controls
have such an ancestor:

- **agent-review** — inside `REPORT_TOOLBAR_ROW_CLASS` (`overflow-x-auto`,
  `report-toolbar.tsx:26`), mounted via `lead-form.tsx` and
  `components/head/head-report-shell.tsx`.
- **admin holidays** — inside the settings `TabsList` (`overflow-x-auto`,
  `settings-tab.tsx:50`).

The other four (version + PDF-export in `DocumentActionGroup` `flex-wrap`; nav
theme + language in `RIGHT_RAIL_CLASS` `relative flex`) are not clipped — which
is why the lead sees the nav theme control "work" and the toolbar one not.

## Decision 1 — migrate Coming-Soon to the Radix Tooltip (portal)

**Chosen:** replace system 3 with a shared `ComingSoonTooltip` wrapper built on
the existing Radix primitive, so the tooltip content portals out of every
overflow ancestor. This is the same escape mechanism `sdlc-tooltip.tsx` already
relies on, applied through the repo's standard Radix primitive.

Wiring (validated against Radix docs / Context7):

- The trigger is the existing inert control. Radix `TooltipTrigger asChild` wraps
  it. The controls already use `aria-disabled="true"` (NOT the `disabled`
  attribute), so they still receive pointer + focus events and the tooltip opens
  — a truly `disabled` button would swallow those events.
- The trigger keeps its `aria-label="<feature> is coming soon"`; the Radix
  content is wired as `aria-describedby`, so there is no double-announce. The
  existing `deferred-feature-pattern` a11y requirement (accessible name via
  `aria-label` or descendant badge text) stays literally satisfied.
- `TooltipProvider` is embedded INSIDE the `ComingSoonTooltip` wrapper itself
  (delayDuration 0), so every mount is self-contained (Codex-verify finding):
  `AgentReviewComingSoon` renders on many standalone surfaces (preview, the
  published `/reports/[reportId]` viewer, the present pages, the slide decks, the
  head shell) where no `TooltipProvider` exists today — a shell-level provider
  enumeration would miss them and the tooltip would silently not open. A
  self-contained wrapper makes that enumeration moot. (Radix nested providers are
  fine.)

**Amber is preserved.** The Radix default content is dark; the spec forbids a
second Coming-Soon colour variant. So the Coming-Soon tooltip content renders the
amber `ComingSoonBadge` itself inside a **chromeless** `TooltipContent` (no
`bg`/padding/dark surface; arrow omitted or amber), so the only visible pixels
are the canonical amber pill. `data-state="coming-soon"` is retained.

**Holidays is a11y-sensitive.** It is an inert `<span>` nested inside the
holidays `TabsTrigger` (`<button>`). `TooltipTrigger asChild` must wrap the span
WITHOUT introducing a nested interactive element (no button-in-button) and
WITHOUT adding an `aria-label` on the span (the spec keeps the coming-soon state
in the tab button's computed name via the descendant badge text). Verify the tab
accname still contains "Coming Soon" after the change.

**Holidays tooltip is hover-only by design (Codex F4).** The inert span is not
independently keyboard-focusable inside its `TabsTrigger`, so the Radix tooltip
opens on mouse hover, not on keyboard focus of the span. This is acceptable
because the coming-soon state is already in the tab's accessible name for AT
users — the visual tooltip is an enhancement, not the sole carrier of meaning.
The contract is recorded in the spec delta (no regression for keyboard/AT).

Retire `COMING_SOON_TOOLTIP_ANCHOR` and the `group-hover` reveal once all six
controls use the wrapper.

## Decision 2 — the "+N more" restyle is DEFERRED to a user decision (not in this change)

**Chosen:** do NOT restyle the shared `TooltipContent` in this change. The lead's
"красивее, не белый на чёрном" is a direction, not a concrete token, and the
shared content is also used by the SDLC stage chips and the sidebar (broad blast
radius). The repo "Visual And Theme Work" rule makes surface/theme restyles
research-only until the user picks a concrete direction. So:

- This change keeps the shared dark `TooltipContent` UNTOUCHED ("+N more", stage
  chips, sidebar unchanged).
- ComingSoon does NOT inherit that dark surface — its wrapper renders the amber
  badge on a CHROMELESS content (no dark fill, no dark arrow), satisfying the
  spec's single-amber-variant rule without touching the shared content.
- The restyle is surfaced as a user decision in the handoff (pick a concrete
  surface — e.g. light card token + border + soft shadow — then it becomes its
  own small change). This keeps the present change a pure clipping/unification fix.

## Honest answer to "tooltip через один инструмент, правильно?"

Partly. After this change the Coming-Soon affordance joins the Radix tooltip used
by "+N more"/stage-chips/sidebar — so those are one tool. The separate
`sdlc-tooltip.tsx` `createPortal` system stays (different problem). So: "two
portal systems, not three; Coming-Soon is now the Radix one."

## Alternatives considered

- **Fix only agent-review** (e.g. drop `overflow-x-auto`): rejected — it breaks
  the toolbar's narrow-width reachability (documented in `report-toolbar.tsx`),
  leaves Holidays broken, and keeps two divergent Coming-Soon mechanisms.
- **Anchor the badge above the control:** rejected — still clipped on the
  vertical axis by the same `overflow:auto` computation.
- **Restore the native `title`:** rejected — that is the double-tooltip the prior
  change deliberately removed, and native titles cannot be styled.

## Test strategy

- `coming-soon-style.test.tsx` currently asserts the CSS anchor tokens
  (`left-1/2`, `-translate-x-1/2`) and source-scans 5 files for
  `COMING_SOON_TOOLTIP_ANCHOR`. These couplings move to assert the Radix wrapper
  is used; the anchor-string scan is removed with the const.
- New jsdom Radix tests follow `radix-tooltip-jsdom-test-recipe`: stub
  `ResizeObserver` + pointer-capture, wrap in `TooltipProvider`, open via focus
  (button controls) / pointerEnter+pointerMove (inert), assert
  `findByRole("tooltip")` shows the amber badge.
- Holidays: assert the tab's computed accessible name still contains
  "Coming Soon".
- Live browser check on `/lead/report` (toolbar) and `/admin` (holidays): hover
  now reveals the amber tooltip; "+N more" renders the softened surface.

## Invariants preserved

- `deferred-feature-pattern`: single canonical amber badge; no second colour
  variant; no stacked native title; inert `aria-disabled`; activation removes the
  wrapper entirely (no feature flag).
- Inline admin integration-row badges untouched.
