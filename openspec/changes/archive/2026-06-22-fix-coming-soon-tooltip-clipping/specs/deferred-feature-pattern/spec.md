## REMOVED Requirements

### Requirement: Every ComingSoon tooltip anchors its badge identically across controls

**Reason**: Replaced by the ADDED "Every ComingSoon tooltip renders through the shared Radix Tooltip portal" requirement below. The shared CSS `COMING_SOON_TOOLTIP_ANCHOR` overlay this requirement mandated (centred `left-1/2 -translate-x-1/2`, never `right-0`) is retired — positioned below the control, it is clipped whenever an ancestor sets `overflow-x-auto` (the report toolbar row; the admin settings `TabsList`), which left the agent-review and Holidays controls with NO visible tooltip on hover. Positioning consistency is now expressed through identical Radix `side`/`align`/`sideOffset` in the ADDED requirement.

**Migration**: The six controls move from the `group-hover` + `COMING_SOON_TOOLTIP_ANCHOR` overlay to the shared Radix Tooltip wrapper; the `COMING_SOON_TOOLTIP_ANCHOR` constant and the `group relative` wrappers are deleted (see the change's tasks).

## ADDED Requirements

### Requirement: Every ComingSoon tooltip renders through the shared Radix Tooltip portal

Every tooltip-anchored ComingSoon control MUST render its tooltip through the shared Radix Tooltip primitive (`packages/ui/src/components/ui/tooltip.tsx`), whose content is portaled out of the DOM flow, so the tooltip is NEVER clipped by an `overflow` ancestor. The previous mechanism — a CSS `group-hover` `ComingSoonBadge` positioned by a shared `COMING_SOON_TOOLTIP_ANCHOR` class below the control — is removed, because a control mounted inside an `overflow-x-auto` ancestor (the report toolbar row; the admin settings `TabsList`) has its `overflow-y` computed to `auto`, which clipped the below-anchored badge and left the control with no visible tooltip on hover.

1. All six tooltip-anchored ComingSoon controls — agent-review, lead version,
   lead PDF-export, nav theme, nav language, and admin holidays — MUST use the
   shared Radix-based ComingSoon tooltip wrapper rather than the retired CSS
   anchor overlay.
2. The visible tooltip label MUST remain the canonical amber `ComingSoonBadge`
   (`data-state="coming-soon"`); the Radix content surface MUST NOT introduce a
   second colour variant (e.g. the Radix default dark `bg-foreground` surface)
   for these controls — the wrapper renders the amber badge on a chromeless
   content with no dark surface and no dark arrow.
3. The control stays inert (`aria-disabled="true"`, never the `disabled`
   attribute, so Radix still receives the hover/focus that opens the tooltip);
   the focusable trigger keeps its full `aria-label` (e.g. "Agent review is
   coming soon") as the SINGLE, PERSISTENT source of the coming-soon state — the
   only signal available in browse mode, when the hover/focus tooltip is closed.
   The amber badge tooltip is therefore DECORATIVE: the shared ComingSoon wrapper
   passes a whitespace `aria-label` to the Radix content, which blanks the
   sr-only description Radix would otherwise wire as the trigger's
   `aria-describedby`. This removes the focus-time double-announce (name +
   "Coming Soon" description) WITHOUT shortening the `aria-label` (which would
   drop the persistent signal). Shortening the five labels was considered and
   REJECTED for that reason. The Holidays inert span is unaffected (its
   accessible name already carries the state via a persistent sr-only badge).
4. Inline (non-tooltip) `ComingSoonBadge` usages — the static admin
   integration-row badges — are NOT tooltip anchors and are out of scope for this
   rule.
5. The badge MUST be positioned identically across all six controls — the same
   Radix `side`/`align`/`sideOffset` for every control — so the badge sits
   consistently regardless of the control's width (icon-only vs text-labelled),
   preserving the prior "anchored identically" invariant via Radix props rather
   than a shared CSS class.
6. The admin Holidays control is an inert `<span>` nested in a `TabsTrigger`
   button and is NOT independently keyboard-focusable, so its Radix tooltip is a
   HOVER-discoverable visual affordance. Its coming-soon state still reaches
   assistive technology through the holidays tab's computed accessible name, as
   already governed by the existing "Deferred Controls Announce Their Coming-Soon
   State" requirement — this change adds no `aria-label` to the span.

#### Scenario: a clipped toolbar control now shows its tooltip

- **WHEN** a lead hovers the Agent-review ComingSoon control on the report toolbar (inside the `overflow-x-auto` toolbar row)
- **THEN** the amber `ComingSoonBadge` tooltip appears via the Radix portal, not clipped by the toolbar's overflow
- **AND** the same holds for the admin Holidays control inside the settings `TabsList`

#### Scenario: every deferred control uses one shared mechanism

- **WHEN** the codebase is scanned for tooltip-anchored ComingSoon controls
- **THEN** all six controls render their tooltip through the shared Radix ComingSoon wrapper
- **AND** no control renders the retired `COMING_SOON_TOOLTIP_ANCHOR` CSS `group-hover` overlay

#### Scenario: the badge stays amber, not the Radix dark default

- **WHEN** any migrated ComingSoon control's tooltip is shown
- **THEN** the visible label is the canonical amber `ComingSoonBadge` (`data-state="coming-soon"`)
- **AND** it does not render on the Radix default dark `bg-foreground`/`text-background` surface

#### Scenario: every control positions its badge identically

- **WHEN** the wide text-labelled agent-review control and an icon-only control (nav theme) both show their tooltip
- **THEN** both badges resolve to the same Radix `side`/`align`/`sideOffset`
- **AND** no control reverts to the retired right-aligned or per-control CSS positioning

#### Scenario: the badge is decorative — the coming-soon state is announced exactly once

- **WHEN** a screen-reader user focuses a button ComingSoon control (e.g. agent-review) and its amber badge tooltip opens
- **THEN** the control's persistent `aria-label` ("… is coming soon") is its accessible NAME
- **AND** its accessible DESCRIPTION is empty (the wrapper blanks Radix's auto `aria-describedby`), so "coming soon" is announced once, not twice
- **AND** with the tooltip closed (browse mode) the same `aria-label` still announces the coming-soon state
