# dependency-currency Specification

## Purpose

Records deliberate dependency-currency decisions where a package cannot simply
be kept on `latest` — specifically deprecated dependencies retained as a
recorded fallback because no maintained successor exists. Keeps the "why we are
knowingly on a deprecated pin" reasoning durable and revisitable, rather than
re-litigating it every audit.

## Requirements

### Requirement: Deprecated Email Components Dependency MUST Have A Recorded Fallback Decision

The `apps/api` workspace MUST retain `@react-email/components@^1.0.12` as a deliberate, recorded fallback for as long as the registry exposes no maintained successor that re-exports the component set its transactional-email templates import, rather than forcing a half-working swap. The retention MUST be revisited when a maintained successor ships, and the rendered transactional-email behavior MUST stay guarded by `render-template.test.ts`.

#### Scenario: No maintained successor exists at decision time

- **WHEN** the deprecation of `@react-email/components@1.0.12` is investigated against the registry
- **THEN** the notice is the generic "Package no longer supported" boilerplate applied across the whole version line, `1.0.12` is the latest published version, and no republished package, no `@react-email/<component>` scoped set, and no `react-email` umbrella export covers the imported components (`Html, Head, Preview, Tailwind, Body, Container, Heading, Text, Button, Section`)
- **AND** the `^1.0.12` pin is left in place as the safe fallback with the finding recorded for the user

#### Scenario: The companion renderer is not dragged along

- **WHEN** the fallback decision is recorded
- **THEN** `@react-email/render@^2.0.8` is left untouched because it is not deprecated and the components retention does not force a coordinated bump

#### Scenario: Behavior stays guarded while on the fallback

- **WHEN** `pnpm --filter @customreport/api test` runs
- **THEN** `render-template.test.ts` passes and `renderEmail` returns `{subject, html, text}` with both the HTML and plaintext multipart halves intact for the `deadline` and `escalation` kinds
- **AND** no test is skipped, quarantined, or deleted to mask a regression

#### Scenario: A maintained successor reopens the upgrade

- **WHEN** a maintained successor that re-exports the imported component set is published
- **THEN** the retention decision is revisited and the migration is reproposed as an isolated change
- **AND** that migration changes only `@react-email/components`, an optionally-forced `@react-email/render` bump, `pnpm-lock.yaml`, and the email template/renderer files under `apps/api/src/modules/email/`, with no unrelated dependency moving alongside it

### Requirement: The @bull-board Package Pair MUST Be On a Single Major

`@customreport/api` MUST declare `@bull-board/api` and `@bull-board/express` at
the same major version, and that major MUST be v7 (`^7.1.5`). The two packages
form a coupled runtime contract — `@bull-board/api`'s `createBullBoard` consumes
`@bull-board/express`'s `ExpressAdapter` — so a mixed-major install is forbidden
because it produces a runtime adapter mismatch.

#### Scenario: Declared versions share the v7 major

- **WHEN** `apps/api/package.json` is inspected after the upgrade
- **THEN** both `@bull-board/api` and `@bull-board/express` are pinned to a v7
  range (`^7.1.5`)
- **AND** the resolved lockfile contains a single 7.x line for the pair with no
  residual v6 copy

#### Scenario: A mixed-major install is rejected

- **WHEN** one of the two `@bull-board/*` packages is on v7 and the other is on
  v6
- **THEN** that state is treated as a defect and the change is not considered
  complete until both are on the same v7 major

### Requirement: Bull Board Mount Survives the v7 Migration Behaviorally Unchanged

The queue monitoring UI MUST still mount at `/admin/queues` after migrating
`apps/api/src/infrastructure/bullmq/bull-board.module.ts` to the v7 API, remain
gated to the head role, and list the existing queues — with no change to the
route, base path, queue construction, or auth middleware.

#### Scenario: The board mounts and lists queues under v7

- **WHEN** the API starts with `@bull-board/*` on v7 and an authenticated head
  session requests `/admin/queues`
- **THEN** the v7 Bull Board UI renders and lists the `pdf-export` and
  `email-reminder` queues
- **AND** the `createBullBoard` / `BullMQAdapter` / `ExpressAdapter` wiring uses
  the v7 import paths and call shapes

#### Scenario: The head-role gate is unchanged by the bump

- **WHEN** `/admin/queues` is requested without a head session after the upgrade
- **THEN** the request is rejected with 401 (no session) or 403 (non-head role)
  exactly as before the bump
- **AND** the `requireHead` middleware and the direct `new Queue(...)`
  construction are byte-identical to their pre-upgrade form

### Requirement: The v7 Bump MUST Pass All Gates Before Merge

The upgrade MUST clear the full gate suite — `pnpm typecheck`, `pnpm lint`,
`pnpm test`, and `pnpm build` — and the change is isolated so that a gate
failure blocks only this change, never an unrelated bump in the same wave.

#### Scenario: Gates run green on the isolated change

- **WHEN** the four gates are run after the bump and migration
- **THEN** all four exit 0
- **AND** if any gate fails, only this `@bull-board` change is held back; other
  wave items proceed independently

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

### Requirement: Node Type Definitions MUST Track The Runtime Major

The `@types/node` major version declared in the workspace MUST be at or below
the Node major the project actually runs (as established by `.nvmrc` and the CI
`NODE_VERSION`), and MUST NOT be declared ahead of that runtime major without a
recorded justification. When `@types/node` is declared in more than one
workspace, all declarations MUST share the same major.

#### Scenario: Types are brought up to the runtime major

- **WHEN** `@types/node` is bumped to `^25.9.1` in root `package.json` and
  `apps/web/package.json`
- **THEN** the declared major (25) is confirmed to be at or below the Node major
  in `.nvmrc` (`25`) and CI `NODE_VERSION` (`25`)
- **AND** both workspace declarations are on the same `@types/node` major

#### Scenario: Types are never ahead of the runtime without justification

- **WHEN** an `@types/node` major bump is proposed
- **THEN** the bump is rejected if its major exceeds the Node major run by
  `.nvmrc` and CI, unless the proposal records an explicit justification for
  running types ahead of the runtime

#### Scenario: Runtime guardrails are not changed by a types-only bump

- **WHEN** the `@types/node` major is bumped for alignment
- **THEN** `engines.node`, `.nvmrc`, and the CI `NODE_VERSION` are left
  unchanged by that bump
- **AND** any remaining mismatch between the `engines.node` floor and the
  runtime major is recorded rather than silently edited

### Requirement: A Major Type Bump MUST Pass The Full Gate Suite

A major upgrade of `@types/node` MUST be validated by the full gate suite on the
target Node major before it is considered complete, and type-level breakages
MUST be resolved with real fixes rather than `any`.

#### Scenario: Gates run on the target runtime

- **WHEN** the `@types/node` major bump is applied and the lockfile refreshed
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass
  while running on Node 25

#### Scenario: Type breaks are fixed, not widened

- **WHEN** the bump surfaces a changed or removed Node typing during typecheck
- **THEN** the break is resolved at the call site or with a documented local
  type assertion
- **AND** it is NOT silenced by widening the affected value to `any`

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

### Requirement: The lucide-react Icon Dependency MUST Track a Maintained Major

The `packages/ui` and `apps/web` workspaces MUST pin `lucide-react` to the
current maintained major (`^1.17.0` at this change). Every icon imported across
the repository MUST resolve to a real export in that major, and the full
`packages/ui` and `apps/web` Vitest suites plus `pnpm build` MUST pass with no
skipped or quarantined tests and no missing-icon build failure.

#### Scenario: Tests and build pass on the upgraded lucide-react

- **WHEN** `pnpm test` and `pnpm build` run with `lucide-react@1.17.0` resolved
  in the lockfile
- **THEN** every `packages/ui` and `apps/web` test passes and the build succeeds
- **AND** no test is skipped, quarantined, or deleted, and no icon import fails
  to resolve

#### Scenario: Icon renames and removals are migrated, not masked

- **WHEN** an icon used by the repo is renamed or removed in the lucide-react 1.0
  major (including any change to the `*Icon`-suffixed alias convention)
- **THEN** every affected import is updated to the new name, or substituted with
  the closest 1.0 successor that preserves the icon's current meaning
- **AND** the fix addresses the cause rather than hiding a missing icon behind a
  fallback or a skipped test

### Requirement: The Two Declaring Workspaces MUST Stay On The Same lucide-react Version

Both workspaces declaring `lucide-react` MUST carry an identical version string
(`packages/ui/package.json` and `apps/web/package.json`), and the lockfile MUST
resolve a single `lucide-react` copy shared by both workspaces, so tree-shaking
is preserved and a single icon set ships.

#### Scenario: Both workspaces resolve one shared version

- **WHEN** `pnpm install` completes after the bump
- **THEN** `packages/ui/package.json` and `apps/web/package.json` both declare
  `lucide-react@^1.17.0`
- **AND** the lockfile resolves exactly one `lucide-react@1.17.0` copy, with no
  duplicate or divergent version across the two workspaces

### Requirement: The lucide-react Upgrade MUST Remain Isolated

The lucide-react bump MUST change only the `lucide-react` dependency and the
files needed to migrate icon imports; it MUST NOT bundle other dependency
upgrades, so a failed validation can be rejected without affecting unrelated
work. The merge decision is the user's.

#### Scenario: No unrelated dependency moves with the bump

- **WHEN** the change is prepared for review
- **THEN** the diff touches only the `lucide-react` entries in
  `packages/ui/package.json` and `apps/web/package.json`, the lockfile, and the
  source files whose icon imports require migration
- **AND** no other major or minor dependency version is changed in the same change

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the upgrade is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the resolved lucide-react version (confirmed identical across both
  workspaces), icon renames/removals encountered and their substitutes, and
  files touched are reported to the user for the merge decision

### Requirement: The Web jsdom Test Environment MUST Track a Maintained Major

The `apps/web` workspace MUST pin `jsdom` to the current maintained major
(`^29.1.1` at this change), and the full `apps/web` Vitest suite MUST pass on
that major with no skipped or quarantined tests. The bump is test-only and MUST
NOT alter production runtime behavior.

#### Scenario: Web test suite passes on the upgraded jsdom

- **WHEN** `pnpm --filter @customreport/web test` runs with `jsdom@29.1.1`
  resolved in the lockfile
- **THEN** every `apps/web` test passes
- **AND** no test is skipped, quarantined, or deleted to achieve the green run

#### Scenario: DOM-behavior breaking changes are migrated, not masked

- **WHEN** a jsdom major changes DOM-API behavior used by the web tests
  (selection/`Range`, `URL`, `fetch`, or `structuredClone` semantics)
- **THEN** the affected test setup or assertions are updated to the new behavior
- **AND** the fix addresses the cause rather than pinning a shim that hides the
  changed semantics

#### Scenario: Node baseline is honored

- **WHEN** the chosen jsdom major declares a minimum Node version
- **THEN** that minimum is satisfied by the repo `engines` constraint
  (`node >=24`) and the CI/local Node in use
- **AND** if it is not, the bump is blocked and reported instead of forced

### Requirement: The jsdom Upgrade MUST Remain Isolated

The jsdom bump MUST change only the `jsdom` dependency and the files needed to
make its test environment pass; it MUST NOT bundle other dependency upgrades, so
a failed validation can be rejected without affecting unrelated work. The merge
decision is the user's.

#### Scenario: No unrelated dependency moves with the bump

- **WHEN** the change is prepared for review
- **THEN** the diff touches only `apps/web/package.json` (the `jsdom` entry), the
  lockfile, and any `apps/web` Vitest config/setup needed for the new major
- **AND** no other major or minor dependency version is changed in the same change

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the upgrade is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the resolved jsdom version, breaking changes encountered, and files
  touched are reported to the user for the merge decision

### Requirement: Minor And Patch Upgrades Land As A Single Gated Batch

Minor and patch dependency upgrades MUST be applied as one batch and validated
by a single full gate pass (`pnpm typecheck && pnpm lint && pnpm test`), rather
than gated per-package. Major-version upgrades MUST NOT ride along in this batch.

#### Scenario: A batch of minor/patch bumps is validated

- **WHEN** all minor/patch dependency bumps from the audit are applied together
- **THEN** the full gate suite is run exactly once over the whole batch
- **AND** the batch is accepted only if `pnpm typecheck`, `pnpm lint`, and `pnpm test` all exit 0

#### Scenario: A major-version bump is attempted in the batch

- **WHEN** a major-version upgrade (e.g. `lucide-react` 0.x -> 1.x, `typescript` 5 -> 6) is proposed for inclusion
- **THEN** it is rejected from the minor/patch batch
- **AND** it is deferred to its own isolated change so any failure stays contained

### Requirement: Coupled Packages MUST Move In Lockstep

Packages that share a runtime adapter, instrumentation version, or plugin contract MUST be upgraded together to the same target version within a batch, so no partial-bump version skew is introduced.

#### Scenario: Sentry instrumentation packages are bumped

- **WHEN** any of `@sentry/nestjs`, `@sentry/nextjs`, `@sentry/node` is bumped
- **THEN** all three are bumped to the same target version (10.55.0) in the same batch

#### Scenario: The typescript-eslint trio is bumped

- **WHEN** any of `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `typescript-eslint` is bumped
- **THEN** all three are bumped to the same target version (8.60.0) so `eslint.config.ts` resolves a single coherent version
- **AND** the lint gate exits 0 against the new version

#### Scenario: The NestJS core trio is bumped

- **WHEN** any of `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` is bumped
- **THEN** all three are bumped to the same target version (11.1.24) in the same batch

#### Scenario: The commitlint pair is bumped

- **WHEN** either `@commitlint/cli` or `@commitlint/config-conventional` is bumped
- **THEN** both are bumped to the same target version (21.0.2) in the same batch

### Requirement: Pre-1.0 Dependencies MUST Be Verified Against Their Consumer

A dependency below version 1.0 MUST be verified against its direct consumer surface before the batch is accepted, because such a release MAY introduce breaking changes even when the registry reports it as minor/patch.

#### Scenario: The Anthropic SDK is bumped

- **WHEN** `@anthropic-ai/sdk` is bumped from 0.98.0 to 0.100.1
- **THEN** the AI-module facade under `apps/api/src/modules/ai/` is confirmed to compile
- **AND** the AI-module tests, including `golden-set.eval.test.ts`, stay green
