# directory-architecture-standard — delta

## ADDED Requirements

### Requirement: The runtime import graph MUST be acyclic and gated

The module graph of `apps/api/src`, `apps/web/src`, `packages/shared/src`, and `packages/ui/src` MUST contain zero runtime circular dependencies (`pnpm depcruise` — type-only imports excluded by config), and the check MUST run as part of `pnpm lint` so a new cycle fails the active gate.

#### Scenario: A new runtime cycle is introduced

- **WHEN** a change adds a value import that closes a cycle between two modules
- **THEN** `pnpm lint` (via depcruise) fails locally and in pre-push before the change can land

### Requirement: Page assemblies live in `features/report-pages`; `report-sections` stays a pure lower floor

`features/report-sections` MUST export only report-domain model and primitive UI with no runtime imports of sibling slices; page-level compositions (lead form family, weekly report page family, head report shell, product accordion) MUST live in `features/report-pages`, which MAY depend on admin/period/report-sections/review/slides but MUST NOT be imported by them.

#### Scenario: A base slice reaches into report-pages

- **WHEN** a file under `features/{admin,period,report-sections,review,slides}` imports from `features/report-pages`
- **THEN** the depcruise/eslint boundary gate fails the change
