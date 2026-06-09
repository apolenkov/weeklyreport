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

### Requirement: Strictness is achieved by ratchet, never by big-bang

The codebase MUST be brought to the standard by ramping one rule (or the single
autofix cluster) at a time, not by enabling the full strict set at once. The
autofixable cluster MUST land first as one isolated mechanical `eslint --fix`
commit with no logic change. After that, each remaining rule MUST go from `off`
to `error` with its own fixup wave and MUST land the gate green before the next
rule is ramped. Behavior-risky rules (`no-unsafe-*`, `no-unnecessary-condition`)
MUST be ramped last.

#### Scenario: a rule is ramped only after the previous one is green

- **WHEN** a maintainer ramps the next strict rule to `error`
- **THEN** the prior rule's cluster has already merged with a green
  `pnpm lint` + `typecheck` + `test`
- **AND** the autofix cluster was committed in isolation before any manual rule
- **AND** `no-unsafe-*` and `no-unnecessary-condition` are scheduled after the
  safer rules

### Requirement: Each firing follows the fix-first escalation ladder

When a ramped rule fires, the response MUST follow this order: (1) fix the code;
(2) only if the firing is a genuine false positive, add a per-site
`eslint-disable-next-line <rule> -- <reason>` with the reason; (3) only as a last
resort, raise the rule's threshold or add it to the documented exclude-list,
recorded in the standard's spec. Mass-disabling a rule, or blanket-raising a
threshold, to force the gate green is forbidden.

#### Scenario: a false positive is suppressed with a reason, not mass-disabled

- **WHEN** a ramped rule fires on a line that is a verified false positive
- **THEN** a single `eslint-disable-next-line` with a written reason is added at
  that site
- **AND** the rule remains `error` everywhere else
- **AND** no file-wide or project-wide disable is introduced to clear the cluster

#### Scenario: a rule's built-in framework-accommodation option is a config choice, not a weakening

- **WHEN** a ramped rule offers a built-in option that encodes a language or
  framework design reality (e.g. `no-extraneous-class` `allowWithDecorator` for
  NestJS decorator-DI, where an empty `@Module` class is correct by design;
  `restrict-template-expressions` `allowNumber` + `allowBoolean` for the
  dominant `${number}` / `${boolean}` interpolation case)
- **THEN** setting that option is a legitimate rule-scoping configuration that
  sits OUTSIDE the fix→disable→exclude ladder — it is neither a per-site
  suppression nor the rung-3 threshold-raise/exclude that the spec restricts
- **AND** the rule still fires on genuine offenders the option does not cover
  (e.g. non-decorated extraneous classes still error)
- **AND** the choice is documented inline in `eslint.config.ts` and recorded in
  the change's `tasks.md`, so it stays auditable

### Requirement: Ratchet work is gated and reviewed per cluster

Each cluster MUST pass `pnpm lint` + `pnpm typecheck` + `pnpm test` before merge.
A PR MAY bundle a few related rules (2–4), composing with one-rule-at-a-time
fixing. Behavior-risky clusters (`no-unsafe-*`, `no-unnecessary-condition`) MUST
receive an Opus-level review before merge.

#### Scenario: a risky cluster is gated and reviewed

- **WHEN** a `no-unsafe-*` cluster is prepared for merge
- **THEN** `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass for that
  cluster
- **AND** the cluster has an Opus-level review recorded
- **AND** the PR groups only related rules, not the whole strict set

### Requirement: Ratchet execution uses a cost-tiered model split and per-cluster budget

Phase-3 execution MUST tier models by task: Haiku for mechanical autofix, Sonnet
for judgment rules, Opus for review of behavior-risky clusters. Budget MUST be
managed **per cluster** — one rule plus a token target per run, no global ceiling
invented up front. The execution Workflow (per-file fan-out, worktree isolation,
per-cluster gate) MUST be authored at execution time, not while the plan is being
written.

#### Scenario: a mechanical cluster runs on the cheap tier

- **WHEN** the autofix cluster is executed
- **THEN** it is handled by the Haiku tier, not Opus
- **AND** a judgment rule cluster is handled by Sonnet
- **AND** a behavior-risky cluster's review is handled by Opus
- **AND** each run is scoped to one rule with its own token target, with no
  global Phase-3 token ceiling
