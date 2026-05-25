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

### Requirement: Backend-Deferred Paths Throw a Loud Stub Error

The backend MUST throw `new Error('Not implemented — see TODO(<ref>)')` at every deferred service or tRPC procedure entry point, where `<ref>` is a stable identifier that also appears as a `TODO(<ref>)` marker at the relevant activation point in the codebase. The deferred path MUST NOT silently return mocked or empty data without the loud stub.

#### Scenario: AI/RAG path is deferred

- **WHEN** a caller invokes the AI/RAG NestJS service method whose implementation is deferred to a later phase
- **THEN** the method throws `new Error('Not implemented — see TODO(<ref>)')` with the matching `<ref>` identifier, and no silent mock response is returned

#### Scenario: Telegram notification path is deferred

- **WHEN** a caller invokes the Telegram notification dispatch path whose implementation is deferred
- **THEN** the entry point throws `new Error('Not implemented — see TODO(<ref>)')` with the matching `<ref>` identifier, and a corresponding `TODO(<ref>)` marker exists at the same location in the source file

### Requirement: Activation Removes the Deferred Marker Entirely

Activating a deferred feature MUST remove the `ComingSoonBadge` wrapper or the `throw` statement entirely from the codebase. Activation MUST NOT be implemented by toggling a feature flag, because no runtime feature flag exists for deferred features under this pattern.

#### Scenario: Language switching is activated

- **WHEN** the language-switching feature is fully implemented and ready for users
- **THEN** `LanguageComingSoonControl` in `apps/web/src/components/navigation/nav-bar.tsx` is replaced with a functional language selector component and all `ComingSoonBadge` wrapping is removed; no feature flag toggle is introduced

#### Scenario: A deferred backend path is activated

- **WHEN** a previously deferred backend path is fully implemented
- **THEN** the `throw new Error('Not implemented — see TODO(<ref>)')` line is deleted and the `TODO(<ref>)` marker at the activation point is removed; the path begins executing real logic without any feature flag conditional
