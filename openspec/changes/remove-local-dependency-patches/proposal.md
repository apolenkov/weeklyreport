# Proposal

## Why

WeeklyReport currently rewrites four published npm packages locally, so installs do not exercise the packages users actually receive from their registries. The owner requires a zero-patch dependency policy while retaining authenticated feedback and secure SAML behavior; the active inventory is `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `patches/`, and the Agentation requirement in `openspec/specs/authenticated-product-feedback/spec.md` (Backlog TASK-050).

## What Changes

- Remove all four `pnpm patchedDependencies` entries and their patch files.
- Use supported published package versions and configuration for Agentation, SAML, XML parsing, and XML signatures.
- **BREAKING**: stop promising the locally patched Agentation popup placement and client-ID preservation that stock Agentation 3.0.2 does not expose.
- Preserve server-side feedback identity, authorization, PostgreSQL persistence, MCP transport, and SAML XML-security checks.
- Add a repository contract that forbids local dependency patching.

## Capabilities

### New Capabilities

- `dependency-integrity`: Requires installations to consume unmodified published packages without `patchedDependencies`.

### Modified Capabilities

- `authenticated-product-feedback`: Limits Agentation behavior to supported public upstream mechanisms while preserving the authenticated product boundary.

## Impact

- Dependency policy: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `patches/`.
- Web: Agentation patch-specific contract tests and stock widget behavior.
- API/auth: SAML and XML parser dependency compatibility and tests.
- Product contract: Agentation popup placement becomes upstream-owned.

## Non-goals

- Replacing Agentation, SAML, PostgreSQL, or the MCP adapter.
- Weakening authentication, authorization, XML parser security, or feedback retention semantics.
- Refactoring unrelated dependency overrides or concurrent product work.
