## Purpose

The deferred-feature pattern governs how CustomReport signals roadmapped but not-yet-implemented capabilities. UI-deferred features MUST surface a visible, inert control with a `ComingSoonBadge` tooltip so the user knows the feature is acknowledged; backend-deferred paths MUST throw a loud stub error so the caller fails fast rather than receiving silent mock data. Consumer surfaces enforcing this pattern are `apps/web/src/components/navigation/nav-bar.tsx` (UI side: `LanguageComingSoonControl`, `ThemeComingSoonControl`) and any NestJS service or tRPC procedure whose implementation is deferred (backend side).

## Requirements

### Requirement: UI-Deferred Features Use ComingSoonBadge

The UI MUST render a visible, disabled control wrapped in a `ComingSoonBadge` from `@customreport/ui` for every deferred user-facing feature. The control MUST NOT be hidden behind a runtime feature flag or omitted from the DOM entirely.

#### Scenario: Language selector is deferred

- **WHEN** a user opens the navigation bar while the language-switching feature is not yet implemented
- **THEN** `LanguageComingSoonControl` renders a disabled button wrapped in `ComingSoonBadge` that shows a tooltip explaining the feature is coming soon, and no runtime feature flag controls its visibility

#### Scenario: Theme switcher is deferred

- **WHEN** a user opens the navigation bar while the theme-switching feature is not yet implemented
- **THEN** `ThemeComingSoonControl` renders a disabled button wrapped in `ComingSoonBadge` that shows a tooltip explaining the feature is coming soon, and no runtime feature flag controls its visibility

#### Scenario: Version history is deferred after full removal

- **WHEN** a lead opens their report toolbar while version history is removed and deferred to a future redesign (`TODO(versions-v2)`)
- **THEN** `VersionComingSoonControl` in `apps/web/src/components/lead/version-coming-soon.tsx` renders a disabled, inert control wrapped in `ComingSoonBadge` that shows a tooltip explaining the feature is coming soon
- **AND** no version list, snapshot view, restore action, or pin control exists anywhere in the UI
- **AND** no runtime feature flag controls its visibility

### Requirement: Backend-Deferred Paths Throw a Loud Stub Error

The backend MUST throw `new Error('Not implemented — see TODO(<ref>)')` at every deferred service or tRPC procedure entry point, where `<ref>` is a stable identifier that also appears as a `TODO(<ref>)` marker at the relevant activation point in the codebase. The deferred path MUST NOT silently return mocked or empty data without the loud stub.

#### Scenario: AI/RAG path is deferred

- **WHEN** a caller invokes the AI/RAG NestJS service method whose implementation is deferred to a later phase
- **THEN** the method throws `new Error('Not implemented — see TODO(<ref>)')` with the matching `<ref>` identifier, and no silent mock response is returned

#### Scenario: Telegram notification path is deferred

- **WHEN** a caller invokes the Telegram notification dispatch path whose implementation is deferred
- **THEN** the entry point throws `new Error('Not implemented — see TODO(<ref>)')` with the matching `<ref>` identifier, and a corresponding `TODO(<ref>)` marker exists at the same location in the source file

### Requirement: Agent-Review Placeholder Covers Every On-Screen Report Surface

The agent-review deferred placeholder MUST render exactly once on every on-screen surface that shows a reader assembled report content, so coverage is consistent across slides, the published viewer, the presentation views, the lead self-preview, and the head report shell. The placeholder MUST be the `AgentReviewComingSoon` component from `apps/web/src/components/report-shell/agent-review-coming-soon.tsx` wrapping a `ComingSoonBadge`, and MUST NOT be hidden behind a runtime feature flag.

#### Scenario: Published report viewer shows the placeholder

- **WHEN** a viewer or head opens `/reports/[reportId]` to read an assembled report
- **THEN** the published-viewer header at `apps/web/src/app/(app)/reports/[reportId]/page.tsx` renders one `AgentReviewComingSoon` control with its coming-soon tooltip

#### Scenario: Presentation surfaces show the placeholder

- **WHEN** a user opens a presentation view at `/head/report/[reportId]/present` or `/reports/[reportId]/present`
- **THEN** each presentation page header renders one `AgentReviewComingSoon` control

#### Scenario: Lead self-preview shows the placeholder

- **WHEN** a lead opens `/lead/report/[reportId]/preview` to read their own section as assembled
- **THEN** the preview page header at `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx` renders one `AgentReviewComingSoon` control

#### Scenario: Slides and head shell keep their existing placeholder

- **WHEN** a user views the lead slides, the head slide deck, or the head report shell
- **THEN** each surface still renders exactly one `AgentReviewComingSoon` control, with no surface rendering two
- **AND** the head report shell toolbar mounts the control in form mode only, because in slides mode the head slide article (`apps/web/src/components/slides/status-slide-deck.tsx`) already carries the surface's single placeholder

### Requirement: Agent-Review Placeholder Is Absent From Print And List Surfaces

The agent-review placeholder MUST NOT render on the print/PDF template or on list-only surfaces that enumerate reports rather than showing one report's content. The print template is a paper artifact where a hover-only "coming soon" tooltip cannot function, and history/archive lists have no single-report anchor for the control.

#### Scenario: Print/PDF template omits the placeholder

- **WHEN** the print template at `apps/web/src/app/print/[reportId]/page.tsx` renders for browser print or PDF export
- **THEN** no `AgentReviewComingSoon` control appears in the printed output

#### Scenario: History and archive lists omit the placeholder

- **WHEN** a user opens a report-listing surface such as `/lead/history`, `/head/history`, or the reports archive tab
- **THEN** no `AgentReviewComingSoon` control appears, because these surfaces list reports rather than render one report's content

### Requirement: Agent-Review Placeholder Stays Inert And String-Stable

The agent-review placeholder MUST remain inert wherever it is mounted, exposing no enabled action, introducing no new color token, and adding no new user-facing string beyond what `AgentReviewComingSoon` already renders. The mounted control MUST keep `aria-disabled="true"` and the existing English copy.

#### Scenario: Mounted placeholder exposes no working action

- **WHEN** a user activates the `AgentReviewComingSoon` control on any surface
- **THEN** nothing happens beyond showing the coming-soon tooltip, and the control reports `aria-disabled="true"`

#### Scenario: Compact variant is allowed in tight header rows

- **WHEN** a header row groups several pill controls at a reduced height
- **THEN** the placeholder MAY be mounted with the `compact` prop so it sits below the cluster's interactive height, consistent with `ui-control-density`

### Requirement: Activation Removes the Deferred Marker Entirely

Activating a deferred feature MUST remove the `ComingSoonBadge` wrapper or the `throw` statement entirely from the codebase. Activation MUST NOT be implemented by toggling a feature flag, because no runtime feature flag exists for deferred features under this pattern.

#### Scenario: Language switching is activated

- **WHEN** the language-switching feature is fully implemented and ready for users
- **THEN** `LanguageComingSoonControl` in `apps/web/src/components/navigation/nav-bar.tsx` is replaced with a functional language selector component and all `ComingSoonBadge` wrapping is removed; no feature flag toggle is introduced

#### Scenario: A deferred backend path is activated

- **WHEN** a previously deferred backend path is fully implemented
- **THEN** the `throw new Error('Not implemented — see TODO(<ref>)')` line is deleted and the `TODO(<ref>)` marker at the activation point is removed; the path begins executing real logic without any feature flag conditional

### Requirement: Every Coming-Soon Affordance Uses One Canonical Badge Style

Every deferred-feature affordance MUST render its "Coming Soon" label through the single shared `ComingSoonBadge` from `@customreport/ui`; no component may hand-roll a separate "Coming Soon" pill or apply a divergent color/variant, so the deferred-feature signal reads identically everywhere.

1. Every visible "Coming Soon" label MUST be a `ComingSoonBadge` instance (it
   carries `data-state="coming-soon"`); no bespoke inline "Coming Soon" markup
   may exist outside that primitive.
2. All rendered Coming-Soon badges MUST resolve to the same canonical
   foreground/background style (the shared amber tokens); there MUST NOT be a
   second color variant (e.g. a red/yellow badge) for any single control.
3. The Agent-review placeholder MUST use the same badge style as the navigation
   and lead-toolbar deferred controls — it is not a special case.

#### Scenario: all on-screen badges share one style

- **WHEN** any surface that renders deferred controls is shown (e.g. the lead
  report toolbar with Agent review, plus the nav-bar Language/Theme controls)
- **THEN** every rendered Coming-Soon badge resolves to the same computed
  foreground and background color, and each is a `ComingSoonBadge`
  (`data-state="coming-soon"`) instance

#### Scenario: no bespoke Coming-Soon pill exists

- **WHEN** the codebase is checked for deferred-feature affordances
- **THEN** no component renders a "Coming Soon" label outside the shared
  `ComingSoonBadge` primitive

### Requirement: Deferred Controls Announce Their Coming-Soon State

Every deferred-feature affordance MUST expose its coming-soon state to assistive technology through the focusable element's computed accessible name, by the mechanism appropriate to that element's role — NOT by forcing an `aria-label` onto an inert non-focusable child.

1. A standalone focusable deferred control (e.g. the Agent-review `<button>`)
   MUST carry an `aria-label` of the form "<feature> is coming soon" as its
   accessible name.
2. The `HolidaysComingSoonControl` is an inert `<span>` nested inside the
   holidays `TabsTrigger` (`<button>`); its coming-soon state MUST be present in
   that tab button's computed accessible name. The `ComingSoonBadge` text
   ("Coming Soon") is a descendant of the tab button, so the tab's accessible
   name already contains it. The inert span MUST NOT carry its own `aria-label`
   (the `2026-06-10` `verify-a11y-recommended-flip` change removed it as
   redundant; re-adding it would pollute the tab button's name computation).

#### Scenario: the holidays deferred state is announced via the tab name

- **WHEN** the admin Settings tablist is rendered
- **THEN** the holidays tab's computed accessible name contains "Coming Soon"
  (contributed by the descendant `ComingSoonBadge`), so a screen-reader user
  hears the deferred state on the focusable tab
- **AND** the inert holidays `<span>` carries no `aria-label` of its own

### Requirement: Inert Coming-Soon controls carry no stacked native title

Every inert Coming-Soon control MUST NOT carry a native `title="Coming Soon"` attribute, because the shared amber `ComingSoonBadge` already renders the control's only tooltip and a duplicate native `title` stacks a second browser-native tooltip on hover (the double-tooltip glitch). This rule covers all inert deferred controls: the nav Theme and Language controls, the lead-toolbar Agent-review, Version, and PDF-export controls, and the admin Holidays control. The control's accessible name is carried by its `aria-label` (the focusable `<button>` controls) or by the `ComingSoonBadge` descendant text (the inert Holidays `<span>` nested inside its `TabsTrigger`), so removing the native title costs no accessible name. A control MAY still use a native `title` for OTHER wording (e.g. a logout button's `title="Sign out"`); only a `title` duplicating the badge's "Coming Soon" text is forbidden.

#### Scenario: a lead-toolbar deferred control shows one tooltip, not two

- **WHEN** a lead hovers the Agent-review, Version, or PDF-export Coming-Soon control on the report toolbar
- **THEN** only the amber `ComingSoonBadge` tooltip appears
- **AND** the control carries no native `title="Coming Soon"` attribute that would stack a second browser-native tooltip

#### Scenario: the source scan covers every inert control

- **WHEN** the codebase is scanned for deferred-feature affordances
- **THEN** none of the five inert Coming-Soon control source files (`agent-review-coming-soon.tsx`, `version-coming-soon.tsx`, `pdf-export-coming-soon.tsx`, `navigation/nav-bar.tsx`, `admin/settings-tab.tsx`) contains a `title="Coming Soon"` attribute

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
