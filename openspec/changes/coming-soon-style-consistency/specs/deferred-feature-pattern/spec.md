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

### Requirement: Deferred UI Controls Carry an Accessible Name

Every inert deferred-feature control MUST expose a descriptive accessible name (an `aria-label`), not only a native `title`, so assistive technology announces what feature is coming soon.

1. Each Family-1 deferred control (an inert host button/affordance with a
   hover-revealed `ComingSoonBadge`) MUST set an `aria-label` of the form
   "<feature> is coming soon", consistent across controls.
2. `HolidaysComingSoonControl` MUST carry an `aria-label` (it currently exposes
   only `title="Coming Soon"`).

#### Scenario: the holidays deferred control is announced

- **WHEN** a screen-reader user focuses the admin Holidays deferred control
- **THEN** it announces an accessible name describing that holiday management is
  coming soon, matching the other deferred controls' convention
