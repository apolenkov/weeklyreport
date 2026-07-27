# dependency-currency Specification

## Purpose

Records deliberate dependency-currency decisions where a package cannot simply
be kept on `latest` — specifically deprecated dependencies retained as a
recorded fallback because no maintained successor exists. Keeps the "why we are
knowingly on a deprecated pin" reasoning durable and revisitable, rather than
re-litigating it every audit.

## Requirements

### Requirement: The @bull-board Package Pair MUST Be On a Single Major

`@customreport/api` MUST declare `@bull-board/api` and `@bull-board/express` at
the same major version, and that major MUST be v8 (`^8.0.1`). The two packages
form a coupled runtime contract — `@bull-board/api`'s `createBullBoard` consumes
`@bull-board/express`'s `ExpressAdapter` — so a mixed-major install is forbidden
because it produces a runtime adapter mismatch.

#### Scenario: Declared versions share the v8 major

- **WHEN** `apps/api/package.json` is inspected after the upgrade
- **THEN** both `@bull-board/api` and `@bull-board/express` are pinned to a v8
  range (`^8.0.1`)
- **AND** the resolved lockfile contains a single 8.x line for the pair with no
  residual v7 copy

#### Scenario: A mixed-major install is rejected

- **WHEN** one of the two `@bull-board/*` packages is on v8 and the other is on
  v7
- **THEN** that state is treated as a defect and the change is not considered
  complete until both are on the same v8 major

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

### Requirement: pnpm Project Settings MUST Live Where pnpm Reads Them

The repository MUST declare `overrides` and `patchedDependencies` in
`pnpm-workspace.yaml`, not in the `package.json` `pnpm` field, because the
installed pnpm (10.11.0) no longer reads that field and warns the keys are
ignored. The security-floor overrides (`@xmldom/xmldom`, `protobufjs`, `vite`,
`fast-uri`) and the `samlify@2.13.1` patch MUST stay applied across the move,
proven by the lockfile, so the SAML auth patch and the version floors are not
silently dropped on the next lockfile regeneration.

#### Scenario: Settings are read from the supported location

- **WHEN** any pnpm command runs after the move
- **THEN** no "the pnpm field ... is no longer read" warning is emitted
- **AND** `pnpm-workspace.yaml` declares `overrides` and `patchedDependencies`
  alongside the existing `onlyBuiltDependencies`
- **AND** the `package.json` `pnpm` field no longer carries `overrides` or
  `patchedDependencies`

#### Scenario: Security floors and the SAML patch survive the move

- **WHEN** `pnpm install` resolves the workspace after the move
- **THEN** `pnpm-lock.yaml` still records the `overrides` block
  (`@xmldom/xmldom>=0.8.13`, `protobufjs>=8.0.2`, `vite>=7.3.2`,
  `fast-uri>=3.1.2`)
- **AND** `pnpm-lock.yaml` still records `patchedDependencies` for
  `samlify@2.13.1` with the patch path applied
- **AND** the resolved `vite` remains `>=7.3.2`

### Requirement: nodemailer MUST Track Its Current Maintained Major

The `@customreport/api` workspace MUST pin `nodemailer` to the current
maintained major (`^9.0.1` at this change), and the transactional-email send
path MUST keep working unchanged. The nodemailer 9.0 breaking change (TLS
certificate validation defaulted on for remote-content, OAuth2-token, and
HTTP/HTTPS-proxy sub-requests) MUST be confirmed not to affect the configured
transports before the bump is accepted.

#### Scenario: The send path is unaffected by the TLS default

- **WHEN** `nodemailer@9` is resolved and `EmailService` is constructed
- **THEN** the dev `jsonTransport` path and the prod SMTP `secure:false` path
  both build with no code change beyond the version bump
- **AND** the configured transports fetch no remote attachment, use no OAuth2
  token endpoint, and route through no HTTP/HTTPS proxy, so the 9.0 TLS default
  does not change behavior

#### Scenario: A live multipart send still arrives intact

- **WHEN** `sendMailMultipart` is exercised against a local Mailpit SMTP server
  on `nodemailer@9`
- **THEN** the message arrives with both the HTML and plaintext halves intact
- **AND** no test is skipped or weakened to pass the bump

#### Scenario: The types stub is reconciled, not stranded

- **WHEN** `nodemailer` is bumped to 9 and `@customreport/api` is typechecked
- **THEN** `@types/nodemailer` is kept at its current maintained major
  (`^8.0.1`), because no `@types/nodemailer@9` is published and `nodemailer@9`
  ships no bundled types, and the typecheck passes against `nodemailer@9`
- **AND** the types major (8) lagging the runtime major (9) is recorded as the
  documented justification, not silently left as drift

### Requirement: eslint-plugin-unicorn MUST Track Its Current Maintained Major

The root `eslint-plugin-unicorn` devDependency MUST pin the current maintained
major (`^68.0.0` at this change), and the curated rule allowlist in
`eslint.config.ts` MUST keep resolving every rule it names, with `pnpm lint`
clean and no rule disabled to mask a removal or rename.

#### Scenario: The curated allowlist still resolves on the new major

- **WHEN** `pnpm lint` runs with `eslint-plugin-unicorn@68` resolved
- **THEN** every `unicorn/*` rule enabled in `eslint.config.ts` resolves to a
  real rule in the new major
- **AND** the lint gate exits 0

#### Scenario: A renamed or removed rule is migrated, not silenced

- **WHEN** the bump renames or removes a `unicorn/*` rule the allowlist enables
- **THEN** the allowlist entry is updated to the rule's new name or successor
- **AND** the rule is not simply deleted or downgraded to silence the change

### Requirement: Transactional Email MUST Track the Maintained react-email Package

The `apps/api` transactional-email templates and renderer MUST import their
components and `render` from the maintained `react-email` package (`^6.6.3` at
this change), replacing the deprecated `@react-email/components` and
`@react-email/render` scoped packages. The migration MUST preserve the rendered
email behavior exactly and MUST stay guarded by `render-template.test.ts` and a
live Mailpit send.

#### Scenario: The maintained successor reopened the retention

- **WHEN** the react-email ecosystem is re-investigated against the registry
- **THEN** `react-email@6.x` is confirmed to re-export the imported component
  set (`Body, Button, Container, Head, Heading, Html, Preview, Section,
Tailwind, Text`) plus `render`, while every scoped `@react-email/<component>`
  and `@react-email/components` is deprecated and frozen
- **AND** the retention decision is reopened and the migration applied

#### Scenario: Imports move to the umbrella in exactly the email files

- **WHEN** the migration is implemented
- **THEN** `render-template.ts`, `deadline.template.tsx`,
  `escalation.template.tsx`, and `escalation.template.test.tsx` import from
  `react-email`
- **AND** `@react-email/components` and `@react-email/render` are removed from
  `apps/api/package.json` and the lockfile

#### Scenario: Rendered behavior stays guarded

- **WHEN** `pnpm --filter @customreport/api test` runs after the migration
- **THEN** `render-template.test.ts` passes and `renderEmail` returns
  `{subject, html, text}` with both multipart halves intact for the `deadline`
  and `escalation` kinds
- **AND** a live Mailpit send renders both templates with no visual regression
- **AND** no test is skipped, quarantined, or deleted to mask a regression

### Requirement: Bull Board Mount Survives the v8 Migration Behaviorally Unchanged

The queue monitoring UI MUST still mount at `/admin/queues` after migrating
`apps/api/src/infrastructure/bullmq/bull-board.module.ts` to the `@bull-board`
v8 API, remain gated to the head role, and list the existing queues — with no
change to the route, base path, queue construction, or auth middleware.

#### Scenario: The board mounts and lists queues under v8

- **WHEN** the API starts with `@bull-board/*` on v8 and an authenticated head
  session requests `/admin/queues`
- **THEN** the v8 Bull Board UI renders and lists the `pdf-export` and
  `email-reminder` queues
- **AND** the `createBullBoard` / `BullMQAdapter` / `ExpressAdapter` wiring uses
  the v8 import paths and call shapes

#### Scenario: The head-role gate is unchanged by the bump

- **WHEN** `/admin/queues` is requested without a head session after the upgrade
- **THEN** the request is rejected with 401 (no session) or 403 (non-head role)
  exactly as before the bump
- **AND** the `requireHead` middleware and the direct `new Queue(...)`
  construction are byte-identical to their pre-upgrade form

### Requirement: The @bull-board v8 Bump MUST Pass All Gates

The `@bull-board` v8 upgrade MUST clear the full gate suite — `pnpm typecheck`,
`pnpm lint`, `pnpm test`, and `pnpm build`. Because this wave is deliberately
bundled, a gate failure holds the whole change for the user's merge decision
rather than only this bump; the implementation MUST keep the bump a separately
revertable commit so it can be dropped if it is the sole failure.

#### Scenario: Gates run green with the bump in the bundle

- **WHEN** the four gates run after the v8 bump and module migration
- **THEN** all four exit 0
- **AND** if the bump is the sole gate failure, its commit can be reverted
  without unwinding the rest of the wave

### Requirement: A Repository Gate MUST Fail When the Image Tag and playwright Version Drift

A repository gate MUST detect drift between the `Dockerfile.api` Playwright base
image tag and the resolved `playwright` version and fail loudly, so the two pins
cannot diverge silently again. The guard MUST run inside `pnpm lint`, and
therefore inside the `.husky/pre-push` gate, alongside the existing
`lint:prisma:typecheck` and `lint:ssot-gate` checks.

#### Scenario: The guard passes when the pins are in lockstep

- **WHEN** `pnpm lint` runs with the `Dockerfile.api` tag and the resolved
  `playwright` version naming the same version
- **THEN** the `lint:playwright-image` step exits 0 and the lint chain completes

#### Scenario: The guard fails when the pins drift

- **WHEN** the `Dockerfile.api` base image tag names a version different from the
  `playwright` version resolved in `pnpm-lock.yaml`
- **THEN** `node scripts/check-playwright-image-sync.mjs` exits non-zero, naming
  both the image tag and the resolved dependency version
- **AND** `pnpm lint` fails as a result, blocking the push

### Requirement: The Node Major MUST Be The One The Images Run

The Node major that the shipped container images execute is the runtime major.
`.nvmrc`, the CI Node version, `engines.node`, and every `@types/node`
declaration MUST equal it — they follow the images rather than define them,
because a gate that passes on a major no container runs proves nothing about
the deployed code. When `@types/node` is declared in more than one workspace,
all declarations MUST share that same major.

#### Scenario: Every declaration agrees with the images

- **WHEN** `scripts/check-runtime-node-sync.ts` runs as part of `pnpm lint`
- **THEN** `.nvmrc`, `engines.node`, the `FROM node:<major>` tag in
  `Dockerfile.api`, the same tag in `Dockerfile.web`, and the `@types/node`
  major in the workspace catalog all resolve to one major
- **AND** the guard exits non-zero naming each disagreeing source when they do
  not

#### Scenario: A base image is changed

- **WHEN** either Dockerfile's base image is changed to one carrying a
  different Node major
- **THEN** the change is incomplete until `.nvmrc`, `engines.node` and the
  `@types/node` declaration are moved with it in the same change
- **AND** a base image whose Node major is not visible in the `FROM` line is
  rejected, because it makes the runtime major unreadable from the repository

#### Scenario: A types bump is proposed ahead of the runtime

- **WHEN** an `@types/node` major bump is proposed that exceeds the major the
  images run
- **THEN** the bump is rejected unless the images move in the same change

#### Scenario: The runtime major reaches end of life

- **WHEN** the Node major in use reaches its end-of-life date in the
  nodejs/Release schedule
- **THEN** moving off it is treated as a defect to be scheduled, not a
  currency upgrade to be deferred
