## ADDED Requirements

### Requirement: All Four Roles MUST Pass UAT With Zero Console Errors

A full UAT sweep across all four roles (lead, head, admin, viewer) MUST
complete with zero browser console errors and no broken UI states before
any production deployment.

#### Scenario: Lead role UAT sweep

- **WHEN** a UAT sweep runs with the lead role via Playwright
- **THEN** all lead-facing pages load without console errors
- **AND** report form, stage chips, version history, and slides mode all render correctly

#### Scenario: Head role UAT sweep

- **WHEN** a UAT sweep runs with the head role via Playwright
- **THEN** all head-facing pages load without console errors
- **AND** dashboard, composite status, and publication flow render correctly

#### Scenario: Admin role UAT sweep

- **WHEN** a UAT sweep runs with the admin role via Playwright
- **THEN** all admin-facing pages load without console errors

#### Scenario: Viewer role UAT sweep

- **WHEN** a UAT sweep runs with the viewer role via Playwright
- **THEN** published reports render correctly in read-only mode

### Requirement: Code Quality Gates MUST Pass Before Deployment

All code-quality gates MUST pass (ESLint, Prettier, TypeScript strict,
full test suite) on the deployment branch before any release.

#### Scenario: Pre-deployment gate check

- **WHEN** the deployment pipeline runs pre-deployment checks
- **THEN** `pnpm typecheck`, `pnpm lint`, and `pnpm test` all exit 0
- **AND** no new ESLint warnings are introduced
