## ADDED Requirements

### Requirement: Inert Coming-Soon controls carry no stacked native title

Every inert Coming-Soon control MUST NOT carry a native `title="Coming Soon"` attribute, because the shared amber `ComingSoonBadge` already renders the control's only tooltip and a duplicate native `title` stacks a second browser-native tooltip on hover (the double-tooltip glitch). This rule covers all inert deferred controls: the nav Theme and Language controls, the lead-toolbar Agent-review, Version, and PDF-export controls, and the admin Holidays control. The control's accessible name is carried by its `aria-label` (the focusable `<button>` controls) or by the `ComingSoonBadge` descendant text (the inert Holidays `<span>` nested inside its `TabsTrigger`), so removing the native title costs no accessible name. A control MAY still use a native `title` for OTHER wording (e.g. a logout button's `title="Sign out"`); only a `title` duplicating the badge's "Coming Soon" text is forbidden.

#### Scenario: a lead-toolbar deferred control shows one tooltip, not two

- **WHEN** a lead hovers the Agent-review, Version, or PDF-export Coming-Soon control on the report toolbar
- **THEN** only the amber `ComingSoonBadge` tooltip appears
- **AND** the control carries no native `title="Coming Soon"` attribute that would stack a second browser-native tooltip

#### Scenario: the source scan covers every inert control

- **WHEN** the codebase is scanned for deferred-feature affordances
- **THEN** none of the five inert Coming-Soon control source files (`agent-review-coming-soon.tsx`, `version-coming-soon.tsx`, `pdf-export-coming-soon.tsx`, `navigation/nav-bar.tsx`, `admin/settings-tab.tsx`) contains a `title="Coming Soon"` attribute
