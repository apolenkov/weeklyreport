## ADDED Requirements

### Requirement: Deprecated Redundant Stub Types MUST Be Removed, Not Bumped

A deprecated `@types/*` stub MUST be removed from the workspace
`devDependencies` rather than pinned or bumped when the runtime package now
ships its own type definitions, PROVIDED the runtime package supplies the needed
types and nothing else directly requires the stub.
For `@types/cookie`, this means it MUST be removed from both `apps/api` and
`apps/web` once the resolved `cookie` package is confirmed to bundle its own
types.

#### Scenario: Redundant deprecated stub is removed

- **WHEN** the resolved `cookie` package declares `"types"` and ships the
  matching declaration file, and no `tsconfig` `types` allowlist names `cookie`
- **THEN** `@types/cookie` is removed from `apps/api/package.json` and
  `apps/web/package.json` `devDependencies`
- **AND** the lockfile is refreshed so the stub is no longer a direct dependency

#### Scenario: Call sites resolve types from the runtime package

- **WHEN** `pnpm typecheck` runs after `@types/cookie` is removed
- **THEN** the `cookie` imports in
  `apps/api/src/modules/auth/auth.controller.ts` and
  `apps/web/src/server/auth/session.ts` resolve against the `cookie` package's
  bundled types with no new errors
- **AND** `@types/cookie-parser` usage in `apps/api` still typechecks, since it
  does not depend on the removed stub

#### Scenario: Removal precondition fails

- **WHEN** the runtime package does NOT supply the needed types, OR a `tsconfig`
  `types` allowlist or another dependency directly requires the stub
- **THEN** the removal is blocked and reported instead of forced
- **AND** any unavoidable retention is a documented, pinned last-published stub
  with a `// TODO` justification, never silenced by widening values to `any`

### Requirement: The Stub Removal MUST Remain Isolated

The `@types/cookie` removal MUST change only the two workspace `package.json`
files and the lockfile; it MUST NOT bundle other dependency changes or alter the
runtime `cookie` dependency, so a failed validation can be rejected without
affecting unrelated work. The merge decision is the user's.

#### Scenario: No unrelated dependency moves with the removal

- **WHEN** the change is prepared for review
- **THEN** the diff touches only `apps/api/package.json`,
  `apps/web/package.json`, and `pnpm-lock.yaml`
- **AND** the runtime `cookie` dependency, `@types/cookie-parser`, and every
  other dependency version are unchanged

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the removal is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the files touched and any breaking findings are reported to the user
  for the merge decision
