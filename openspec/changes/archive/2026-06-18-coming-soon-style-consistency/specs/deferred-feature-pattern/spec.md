## ADDED Requirements

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
