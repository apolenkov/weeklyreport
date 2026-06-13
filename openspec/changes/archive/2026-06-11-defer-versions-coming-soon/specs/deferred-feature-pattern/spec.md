# deferred-feature-pattern (delta)

## MODIFIED Requirements

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
