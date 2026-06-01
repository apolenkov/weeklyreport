# lint-max-strictness-standard Specification

## Purpose

TBD - created by archiving change declare-lint-max-strictness. Update Purpose after archive.

## Requirements

### Requirement: The strictness base is full strictTypeChecked plus stylisticTypeChecked

The declared base MUST be the full `@typescript-eslint` `strictTypeChecked` and
`stylisticTypeChecked` rule sets as the Phase-3 enforcement target, governed by
an explicit, documented **exclude-list**. Any rule the project chooses to soften
MUST appear on that exclude-list with a recorded justification — softening MUST
NOT be a silent omission. The exclude-list MUST NOT be empty: it inherits the
Phase-1 a11y carve-outs (see the reconciliation requirement).

#### Scenario: a softened rule is justified, not dropped silently

- **WHEN** Phase 3 decides a strict rule cannot be enforced as `error`
- **THEN** that rule is recorded on the documented exclude-list with its reason
- **AND** a rule absent from both the enforced set and the exclude-list is
  treated as an oversight, not an intentional gap

### Requirement: The declared plugin surface extends the type-aware base

Beyond the type-aware base, the standard MUST declare these plugin families as
in-scope targets, under the principle "TS best practices, no overengineering":
`eslint-plugin-sonarjs` (including `cognitive-complexity`, deferred here from
Phase 1), `eslint-plugin-unicorn` (pruned — see the unicorn requirement),
`eslint-plugin-jsdoc` (public API only — see the JSDoc requirement),
import-boundary enforcement (see the boundary requirement),
`eslint-plugin-simple-import-sort` (net-new; Biome did not sort imports), and the
core `max-lines` / `max-lines-per-function` (see the thresholds requirement).

#### Scenario: the plugin surface is enumerated

- **WHEN** a reader consults the standard for which rule families are targeted
- **THEN** sonarjs, unicorn (pruned), jsdoc (public API), import-boundaries,
  simple-import-sort, and max-lines are each listed as Phase-3 targets
- **AND** each carries the scope/threshold qualifier defined by its own
  requirement

### Requirement: Size and complexity thresholds are pinned with exempt directories

The standard MUST pin `max-lines` at 300 with `skipBlankLines: true` and
`skipComments: true`; cyclomatic complexity (`complexity`) at ≤ 10; and cognitive
complexity (`sonarjs/cognitive-complexity`) at ≤ 15. These repo thresholds
supersede the global CLAUDE.md defaults (files 250–300, cyclo ≤ 5, cogn ≤ 8) via
the global "repo config wins" rule. The size, complexity, and JSDoc rules MUST
exempt: tests (`*.test.*`, e2e), generated (`prisma/generated`), seeds
(`prisma/seed*.ts`), and config (`*.config.ts`).

#### Scenario: a long generated file is not flagged for size

- **WHEN** Phase 3 enforces `max-lines`
- **THEN** a 600-line file under `prisma/generated` is not reported
- **AND** a 350-line hand-written file under `apps/web/src` is reported
- **AND** the threshold counts neither blank lines nor comments

### Requirement: JSDoc is required only on cross-package public API

The JSDoc requirement MUST scope to exported declarations from the
`packages/shared` (`./` and `./trpc`) and `packages/ui` entry points only —
the surface that crosses a package boundary. `apps/*` (including the 9 tRPC
routers and 38 Nest providers) MUST be off for JSDoc, because they are
app-internal wiring and the tRPC contract is already typed end-to-end and
documented by the `shared` Zod schemas.

#### Scenario: a shared export needs a doc block, an app handler does not

- **WHEN** Phase 3 enforces the JSDoc rule
- **THEN** an exported function from `packages/shared/src/index.ts` lacking a
  JSDoc block is reported
- **AND** an internal function inside `apps/api/src` is not reported
- **AND** a tRPC router procedure is not reported

### Requirement: Import boundaries enforce the monorepo dependency map

The standard MUST declare these import boundaries (verified clean in code at
declaration time): `packages/*` MUST NOT import from `apps/*`; `packages/shared`
and `packages/ui` MUST NOT import each other; `apps/api` MUST NOT import
`packages/ui` or `apps/web`; `apps/web` MUST NOT import `apps/api` **except via
`import type`** (the AppRouter tRPC contract at `apps/web/src/lib/trpc.ts`). The
type-only carve-out MUST be rule-enforced (e.g.
`@typescript-eslint/no-restricted-imports` with `allowTypeImports: true`), not a
per-site disable.

#### Scenario: a value import across the web→api boundary is rejected

- **WHEN** Phase 3 enforces import boundaries
- **THEN** `import { something } from "@customreport/api/..."` in `apps/web` is
  reported
- **AND** `import type { AppRouter } from "@customreport/api/..."` is allowed
- **AND** any `import` from `apps/*` inside `packages/*` is reported

### Requirement: unicorn is declared with a pruned off-list

The unicorn recommended set MUST be declared with the following rules turned
**off** as "overengineering" for this stack: `prevent-abbreviations`, `no-null`
(Prisma/React use null pervasively), `no-array-reduce`, `no-nested-ternary`, and
`prefer-top-level-await`. `unicorn/filename-case` (kebab) MUST be KEPT, since the
repo has 0 non-kebab `*.ts`/`*.tsx` files (camelCase and PascalCase both checked,
excluding generated/ignored dirs) and the rule is therefore free.

#### Scenario: a pruned unicorn rule does not fire

- **WHEN** Phase 3 enforces the unicorn surface
- **THEN** a variable named `props` does not trigger `prevent-abbreviations`
- **AND** a kebab-case filename satisfies `filename-case`
- **AND** a `null` return value does not trigger `no-null`

### Requirement: Phase-1 sub-max severities are reconciled with the standard

The standard MUST record how Phase-1's existing sub-max severities reconcile with
max strictness. The a11y carve-outs
(`jsx-a11y/no-noninteractive-element-interactions: off`,
`jsx-a11y/label-has-associated-control: off`, and the test-file full-a11y-off
override) MUST be **inherited as documented exclusions, not reopened** — reopening
would collide with the active `verify-a11y-recommended-flip` runtime sweep. The
existing non-preset warns MUST carry a per-rule disposition:
`@typescript-eslint/no-non-null-assertion` → Phase-3 `error`;
`react-hooks/exhaustive-deps` → stays `warn` (advisory, false-positive-prone);
`react/jsx-no-useless-fragment` → Phase-3 `error`;
`unused-imports/no-unused-imports` → Phase-3 `error`.

#### Scenario: a11y carve-outs are not reopened by the strictness declaration

- **WHEN** the max-strictness standard is declared
- **THEN** the two `jsx-a11y` off rules and the test-file a11y override remain
  `off` and appear on the documented exclude-list
- **AND** `react-hooks/exhaustive-deps` remains a `warn` target, not `error`
- **AND** `@typescript-eslint/no-non-null-assertion` is recorded as a Phase-3
  `error` target
