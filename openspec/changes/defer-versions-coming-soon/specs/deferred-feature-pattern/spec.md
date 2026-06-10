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

#### Scenario: Version history navigation is deferred

- **WHEN** a lead opens their report toolbar while version history is deferred (`TODO(defer-versions-coming-soon)`)
- **THEN** `VersionHistoryNav` in `apps/web/src/components/lead/version-history-nav.tsx` renders a disabled, inert control wrapped in `ComingSoonBadge` that shows a tooltip explaining the feature is coming soon
- **AND** no version navigation arrows, version pill interaction, snapshot view overlay, or restore action is reachable from the UI
- **AND** no runtime feature flag controls its visibility

### Requirement: Backend-Deferred Paths Throw a Loud Stub Error

The backend MUST throw `new Error('Not implemented — see TODO(<ref>)')` at every deferred service or tRPC procedure entry point, where `<ref>` is a stable identifier that also appears as a `TODO(<ref>)` marker at the relevant activation point in the codebase. The deferred path MUST NOT silently return mocked or empty data without the loud stub.

#### Scenario: AI/RAG path is deferred

- **WHEN** a caller invokes the AI/RAG NestJS service method whose implementation is deferred to a later phase
- **THEN** the method throws `new Error('Not implemented — see TODO(<ref>)')` with the matching `<ref>` identifier, and no silent mock response is returned

#### Scenario: Telegram notification path is deferred

- **WHEN** a caller invokes the Telegram notification dispatch path whose implementation is deferred
- **THEN** the entry point throws `new Error('Not implemented — see TODO(<ref>)')` with the matching `<ref>` identifier, and a corresponding `TODO(<ref>)` marker exists at the same location in the source file

#### Scenario: Version-history endpoints are deferred

- **WHEN** a caller invokes the tRPC procedures `leadForm.versions`, `leadForm.getVersion`, `leadForm.restoreVersion`, or `leadForm.createSnapshot` while version history is deferred
- **THEN** each procedure throws `new Error('Not implemented — see TODO(defer-versions-coming-soon)')` before reaching the service layer, and a matching `TODO(defer-versions-coming-soon)` marker exists at the procedure
- **AND** the `VersionSnapshot` Prisma model, the version services, and their integration tests remain intact (no destructive migration), preserving the behavioral spec for re-enable
