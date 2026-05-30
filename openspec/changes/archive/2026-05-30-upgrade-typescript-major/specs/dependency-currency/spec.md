## ADDED Requirements

### Requirement: The TypeScript Compiler MUST Track a Maintained Major

The root `typescript` devDependency MUST pin the current maintained major
(`^6.0.3` at this change), and every strict-mode workspace MUST typecheck, lint,
test, and build clean on that compiler with no suppressed errors and no loosened
strict flags.

#### Scenario: Repo-wide typecheck passes on the upgraded compiler

- **WHEN** `pnpm typecheck` and `pnpm lint:prisma:typecheck` run with
  `typescript@6.0.3` resolved in the lockfile
- **THEN** `apps/api`, `apps/web`, `packages/shared`, `packages/ui`, and the
  root `tsconfig.prisma.json` typecheck all pass
- **AND** no `// @ts-expect-error`, `// @ts-ignore`, or relaxed strict flag is
  introduced to achieve the green run

#### Scenario: Breaking changes are migrated, not masked

- **WHEN** TypeScript 6.0 removes a deprecated flag/API or tightens a default
  that the tsconfigs or source rely on
- **THEN** the affected `tsconfig.base.json`, per-workspace `tsconfig.json`,
  `tsconfig.prisma.json`, or source is updated to the new behavior
- **AND** the fix addresses the cause rather than disabling the check that
  surfaced it

### Requirement: The TypeScript Bump MUST Co-Bump the tseslint Trio

The TypeScript 6.0 upgrade MUST move the `@typescript-eslint` trio
(`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and
`typescript-eslint`) to the line that supports TypeScript 6.0 (`8.60.0`) in the
same change, so type-aware ESLint continues to run against the new compiler.

#### Scenario: Type-aware linting runs on the upgraded compiler

- **WHEN** `pnpm lint` runs with `typescript@6.0.3` resolved
- **THEN** ESLint type-aware linting (driven by `projectService` in
  `eslint.config.ts`) runs under the `@typescript-eslint` `8.60.0` trio and
  exits 0
- **AND** no type-aware lint rule is disabled to make the gate pass

#### Scenario: The trio is not double-bumped elsewhere

- **WHEN** the change is prepared for review
- **THEN** the `@typescript-eslint` trio version is set here as the required TS6
  co-bump
- **AND** the same trio is not bumped again in the `dependency-upgrades-minor`
  change

### Requirement: The TypeScript Upgrade MUST Remain Isolated From Other Wave-3 Majors

The TypeScript bump MUST change only `typescript`, its required tseslint trio,
and the tsconfig/source files needed to make the repo gates pass; it MUST NOT
bundle the other Wave-3 major upgrades, so a failed validation can be rejected
without affecting unrelated work. The merge decision is the user's.

#### Scenario: No unrelated major moves with the bump

- **WHEN** the change is prepared for review
- **THEN** the diff touches only the root `typescript` and `@typescript-eslint`
  trio entries, the lockfile, and any tsconfig/source needed for TS6
- **AND** no other Wave-3 major (`@types/node`, `@vitejs/plugin-react`, `jsdom`,
  `lucide-react`, `@bull-board/*`) is changed in the same change

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the upgrade is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the resolved `typescript` and `@typescript-eslint` versions, breaking
  changes encountered, and files touched are reported to the user for the merge
  decision
