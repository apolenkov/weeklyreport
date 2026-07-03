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

### Requirement: Source comments fit a three-line WHY budget

A comment in `src` MUST state a non-obvious WHY that the code cannot express,
within a budget of three lines; code a competent reader can follow from names
and types MUST carry no comment at all. Narration of what the code already
says, change-log/ticket/phase archaeology, and JSDoc blocks on app-internal
declarations (anything outside the cross-package public API defined by the
JSDoc requirement) are noise and MUST be removed during exemplary sweeps.

#### Scenario: a narration comment is removed

- **WHEN** a sweep encounters a comment that restates what the adjacent code
  does (e.g. "validate the role, then build the session")
- **THEN** the comment is deleted with no replacement

#### Scenario: a terse non-obvious WHY survives

- **WHEN** a sweep encounters a two-line comment stating a constraint the code
  cannot express (e.g. why a read must stay lazy to avoid a boot-order crash)
- **THEN** the comment is kept as-is

#### Scenario: an app-internal JSDoc block is removed

- **WHEN** a sweep encounters a JSDoc block on a non-exported helper inside
  `apps/api/src` or `apps/web/src`
- **THEN** the block is removed, or reduced to a WHY line within the budget if
  one is genuinely non-obvious

### Requirement: Over-budget rationale is relocated before compression

Load-bearing rationale that exceeds the comment budget MUST be relocated, not
deleted: the sweep MUST first verify a covering requirement exists in
`openspec/specs/` (or an ADR) and add one when absent, and only then compress
the code comment to at most two lines, optionally pointing at the spec.
Deleting load-bearing rationale without relocation MUST be treated as a
review-blocking violation.

#### Scenario: rationale already captured by a spec compresses safely

- **GIVEN** a 10-line comment explaining the HS256 algorithm pin, and
  `jwt-session-integrity` already requires the `["HS256"]` allow-list
- **WHEN** the sweep processes the file
- **THEN** the comment compresses to at most two lines (optionally naming the
  spec), and the rationale survives in the spec

#### Scenario: rationale with no spec home is relocated first

- **WHEN** a sweep finds an over-budget comment carrying rationale no spec or
  ADR covers
- **THEN** the sweep adds the covering requirement (or ADR) before compressing
  the comment

#### Scenario: silent deletion is rejected

- **WHEN** a review finds a sweep deleted an over-budget load-bearing comment
  with no covering spec or ADR added
- **THEN** the sweep is rejected until the rationale is relocated

### Requirement: Comment sweeps over security-sensitive paths pass security review

A comment sweep MUST pass a security review before merge whenever it removes
or compresses comments in security-sensitive paths (including but not limited
to authentication, JWT, session cookies, redirects, rate limiting, CSP, CSRF,
password/secret handling, authorization checks), so that a protective
rationale is never lost by a style-only diff.

#### Scenario: an auth comment sweep is security-reviewed

- **WHEN** a comment-only sweep touches `apps/api/src/modules/auth`
- **THEN** the diff passes a security review pass before merge
- **AND** a finding that a compressed comment dropped an unspecced protective
  rationale blocks the merge until relocation completes

### Requirement: Comment policy is enforced by review, not lint

The comment policy MUST be enforced as an audit/PR-review dimension: no lint
rule judges comment noise, a lint-green run MUST NOT be read as
comment-clean, the per-folder exemplary done-signal MUST include a
comment-policy review pass in addition to exemption-free lint, and standing
PR review MUST apply the policy to every later diff so a swept folder cannot
silently regress between sweeps.

#### Scenario: lint-green does not close a folder with over-budget comments

- **WHEN** a folder passes `eslint --max-warnings 0` with no exemptions but
  still carries over-budget or narration comments
- **THEN** the folder is not "done" until a review pass confirms the comment
  policy holds

#### Scenario: a post-sweep PR reintroducing noise is caught in its own review

- **GIVEN** a folder already swept to the comment policy
- **WHEN** a later PR adds a narration comment or an over-budget block there
- **THEN** that PR's review flags it against this policy — detection does not
  wait for the folder's next sweep
