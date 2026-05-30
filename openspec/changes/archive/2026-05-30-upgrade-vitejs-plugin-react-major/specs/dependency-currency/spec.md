# Dependency Currency — @vitejs/plugin-react

## ADDED Requirements

### Requirement: apps/web MUST run @vitejs/plugin-react v6 on a satisfied Vite baseline

The `@customreport/web` workspace MUST depend on `@vitejs/plugin-react` at major
version 6 (`^6.0.2`), and its declared `vite` floor MUST be `^8.0.0` or higher so
the manifest cannot resolve a Vite version (7 or below) that the plugin no longer
supports. The bump MUST NOT regress the Vitest 4 / React 19 / jsdom test setup.

#### Scenario: The bumped plugin resolves against a supported Vite

- **WHEN** `pnpm install` resolves the `@customreport/web` dependency tree
- **THEN** `@vitejs/plugin-react` resolves to `6.x`
- **AND** the resolved `vite` is `>=8.0.0`
- **AND** the declared `vite` range in `apps/web/package.json` is `^8.0.0` or
  higher, not `>=7.3.2`

#### Scenario: The web test suite still passes under v6

- **WHEN** `pnpm --filter @customreport/web test` runs after the bump
- **THEN** the Vitest jsdom suite compiles and passes with no JSX or
  React-Refresh transform errors
- **AND** the production build (`pnpm build`) compiles, proving the Next.js
  react-compiler path is unaffected

### Requirement: The Babel pairing MUST be added only when empirically required

Because v6 removes the bundled Babel dependency, the migration MUST NOT add
`@rolldown/plugin-babel` or `reactCompilerPreset` to `apps/web/vitest.config.ts`
speculatively. It MUST add them only if a test gate proves the bare `react()`
transform regressed without them. The Next.js build's react-compiler path
(`next.config.ts`) is independent of `@vitejs/plugin-react` and MUST NOT be
rewired by this change.

#### Scenario: No transform regression — config stays untouched

- **WHEN** `react()` is invoked with no Babel options in
  `apps/web/vitest.config.ts` and `pnpm --filter @customreport/web test` passes
- **THEN** no Babel plugin is added to the Vitest config
- **AND** `@rolldown/plugin-babel` is not introduced as a dependency

#### Scenario: Transform regression — Babel pairing is added per the v6 path

- **WHEN** the web test suite fails with a JSX or React-Refresh transform error
  after the bump
- **THEN** `@rolldown/plugin-babel` with the exported `reactCompilerPreset` is
  added to `apps/web/vitest.config.ts` per the v6 migration note
- **AND** the web test suite then passes

### Requirement: This dependency bump MUST remain isolated

This change MUST modify only the `@customreport/web` workspace and the lockfile,
so a regression from this single breaking major cannot block the rest of the
dependency wave. The merge decision MUST remain with the user.

#### Scenario: Scope is confined to apps/web

- **WHEN** the change is implemented
- **THEN** the only modified manifests are `apps/web/package.json` and
  `pnpm-lock.yaml`
- **AND** `apps/api`, `packages/shared`, and `packages/ui` manifests are
  unchanged
- **AND** the change is mergeable independently of other Wave-3 dependency
  changes
