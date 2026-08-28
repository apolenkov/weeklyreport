# lint-max-strictness-standard Specification

## Purpose

Declare the maximum ESLint strictness target, pinned structural limits, scoped public JSDoc and import boundaries, and the fix-first ratchet used to reach it.

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

The standard MUST pin maintained product code to `max-lines` at 230 with
`skipBlankLines: true` and `skipComments: true`, `max-lines-per-function` at 57
counted lines with blank lines and comments excluded, cyclomatic complexity at
no more than 10, and `sonarjs/cognitive-complexity` below 10. The maintained
product surface MUST include hand-written source under `apps/api/src`,
`apps/web/src`, `packages/shared/src`, and `packages/ui/src` unless a file has a
stable, explicit repository role that makes a product rule inapplicable. The
maintained product surface MUST also reject avoidable `let`, reassignment, and
in-place mutation.

Tests, generated sources, fixtures, seeds, configuration, and externally
constrained adapters MAY use separately measured rule scopes only when an
explicit role classification records the scope, owner, rationale, and
executable policy probe. A maintained product file MUST NOT use a path-specific
override, inline suppression, or broad role classification as an exemption from
these thresholds.

#### Scenario: a long generated file is not flagged for size

- **WHEN** the standard enforces `max-lines`
- **THEN** an explicitly classified 600-line generated file under
  `prisma/generated` is not reported by the maintained-product rule
- **AND** a 231-line hand-written product file is reported
- **AND** a 230-line hand-written product file is accepted
- **AND** the threshold counts neither blank lines nor comments
- **AND** a policy probe fails if that generated role is applied to maintained
  product source

#### Scenario: the file threshold accepts its boundary and rejects overflow

- **WHEN** a hand-written product file contains 230 counted lines
- **THEN** the file is not reported by `max-lines`
- **AND** the same file at 231 counted lines is reported
- **AND** test, generated, fixture, seed, config, and externally constrained
  adapter scopes remain separately classified and measured
- **AND** no product-path override raises the file limit

#### Scenario: A product function exceeds the limit

- **WHEN** a hand-written product function contains 57 counted lines, has
  cyclomatic complexity 10, and has cognitive complexity 9
- **THEN** none of those boundaries is reported
- **AND** the same function at 58 counted lines is reported
- **AND** cyclomatic complexity 11 is reported at error severity
- **AND** cognitive complexity 10 is reported at error severity
- **AND** no product-path override raises either limit

#### Scenario: Product code uses avoidable mutation

- **WHEN** a maintained product module uses `let`, reassignment, or in-place mutation
  without an externally imposed mutation boundary
- **THEN** the effective ESLint configuration reports the construct at error severity
- **AND** the correction expresses the transformation immutably rather than hiding it
  behind a cast or suppression

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
`import type`** (the AppRouter tRPC contract at `apps/web/src/shared/lib/trpc/trpc.ts`). The
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
would collide with the focused `verify-a11y-recommended-flip` gate. The
existing non-preset warns MUST carry a per-rule disposition:
`@typescript-eslint/no-non-null-assertion` → Phase-3 `error`;
`react-hooks/exhaustive-deps` → Phase-3 `error`;
`react/jsx-no-useless-fragment` → Phase-3 `error`;
`unused-imports/no-unused-imports` → Phase-3 `error`.

#### Scenario: a11y carve-outs are not reopened by the strictness declaration

- **WHEN** the max-strictness standard is declared
- **THEN** the two `jsx-a11y` off rules and the test-file a11y override remain
  `off` and appear on the documented exclude-list
- **AND** `react-hooks/exhaustive-deps` is recorded as an `error` target
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

### Requirement: Magic numbers and repeated string literals are lifted to named constants

The standard MUST enable `@typescript-eslint/no-magic-numbers` as `error` (the
TS-aware variant, which understands enums, numeric-literal types, and `readonly`
class fields), and MUST enforce a documented magic-string policy: a literal
carrying meaning in logic is lifted to a named `const`, `enum`, or config value.
The numeric rule MUST match the live configuration in `eslint-config/core.ts`
and its scoped exemptions in `eslint-config/overrides.ts`: `ignore: [-1, 0, 1, 2]`
(the obvious-arithmetic set), `enforceConst: true`, `ignoreArrayIndexes: true`,
`ignoreEnums: true`, `ignoreReadonlyClassProperties: true`,
`ignoreTypeIndexes: true`, and `ignoreNumericLiteralTypes: true`. The rule MUST
reuse the standard's existing
exempt set — tests (`*.test.*`, e2e), generated (`prisma/generated`), seeds
(`prisma/seed*.ts`), config (`*.config.ts`) — plus one-off operational scripts.

There is no TS-aware "no-magic-strings" rule, so the magic-string requirement is
a documented policy enforced at review, with one mechanical subset: the
repeated-string case MUST be enforced by flipping `sonarjs/no-duplicate-string`
(present in the spread sonarjs recommended set but currently `off`) to `error`,
so a string literal repeated above the rule's threshold is reported. A single,
non-repeated inline string is governed by the review policy, not by a lint error.

#### Scenario: a bare magic number is flagged but exempt values are not

- **WHEN** `@typescript-eslint/no-magic-numbers` is enforced
- **THEN** a bare numeric literal used in logic (e.g. a `3600` timeout) is
  reported
- **AND** `-1`, `0`, `1`, `2` in obvious arithmetic, an array index, an `enum`
  member, and a `readonly` class field initializer are NOT reported
- **AND** the same literal inside a `*.test.*` file or a one-off script is NOT
  reported

#### Scenario: a repeated string is flagged, a one-off string is a review concern

- **WHEN** the magic-string policy is enforced
- **THEN** a string literal repeated above `sonarjs/no-duplicate-string`'s
  threshold is reported by that rule
- **AND** a single non-repeated inline string is not a lint error but is subject
  to the documented lift-to-`const`/`enum`/config review policy
- **AND** the empty string and empty array remain exempt per `code-style.md`

### Requirement: Size and magic-literal policy changes use an explicit ratchet

Policy changes MUST reuse the standard's existing ratchet discipline — the
fix-first escalation ladder, the per-cluster `pnpm lint` + `typecheck` + `test`
gate, and the cost-tiered model split — rather than restating or weakening it.
Any threshold change MUST be explicitly approved by the owner and migrated in
one coherent update across ESLint, planted boundary probes, durable specs, and
canonical documentation. Bringing code under the active thresholds proceeds one
cluster at a time; a file is moved to a justified-permanent exempt block only
when a split would hurt clarity, never to hide an unmeasured violation.

Because `@typescript-eslint/no-magic-numbers` is NOT autofixable, the
"isolated autofix-first cluster" rung of the existing ratchet requirement does
NOT apply to it: every firing is a manual (Sonnet-tier) judgment fix under the
fix-first ladder, with Opus review reserved for clusters whose fix changes
structure. The numeric rule and `sonarjs/no-duplicate-string` MUST each be
ramped from `off`/grandfathered to `error` with their own fixup wave, never the
whole tightening at once. Violation counts MUST be measured at execution time
with a per-cluster budget and no global ceiling.

#### Scenario: an approved threshold change remains observable

- **WHEN** the owner approves a new `max-lines` or function-size threshold
- **THEN** the executable configuration, boundary probes, durable specification,
  and canonical documentation name the same value
- **AND** the affected policy probes and lint gate pass before the change lands
- **AND** the migration records the before/after violation counts without
  representing the relaxation as remediation

#### Scenario: the non-autofixable magic-number rule skips the autofix rung

- **WHEN** `@typescript-eslint/no-magic-numbers` is ramped to `error`
- **THEN** there is no isolated `eslint --fix` commit for it, because the rule
  has no autofix
- **AND** each firing is fixed manually by lifting the literal to a named
  constant under the fix-first ladder
- **AND** the per-cluster gate and cost-tiered model split from the existing
  ratchet requirements still apply unchanged

### Requirement: The auth module is the comment-policy calibration exemplar

The `apps/api/src/modules/auth` folder MUST be maintained as the reference
exemplar of the three-line WHY comment budget and the relocation-before-compression
rule: across every source file in the folder, each comment either states a
non-obvious WHY within budget or names its covering `openspec/specs/` requirement,
and the folder MUST carry no what-narration, no change-log/ticket/phase archaeology,
and no JSDoc on app-internal (non cross-package-public) declarations. Establishing
this state is a comment-only change that MUST NOT alter runtime behavior, exports,
or signatures, and — because the folder is a security-sensitive path — MUST pass
the auth security review before merge. Any over-budget comment whose covering
requirement is not yet durable in `openspec/specs/` MAY be retained verbatim; that
retention is the relocation-before-compression rule in action, NOT a violation, and
the pending compression MUST remain a tracked task rather than a silent deletion.

#### Scenario: over-budget rationale already homed in a spec compresses to a pointer

- **GIVEN** an over-budget WHY comment in the folder whose protective rationale is
  already required durably by a requirement under `openspec/specs/`
- **WHEN** the calibration sweep processes that comment
- **THEN** the block compresses to at most two lines optionally naming that
  covering requirement, and any co-located change-log/ticket/phase archaeology is
  deleted
- **AND** no runtime behavior, export, or signature changes

#### Scenario: rationale with no durable spec home is retained, not compressed

- **GIVEN** an over-budget WHY comment in the folder whose covering requirement is
  not yet durable under `openspec/specs/`
- **WHEN** the sweep reaches that comment
- **THEN** the comment is retained verbatim rather than compressed to a
  spec-pointer that would dangle for a reader grepping `openspec/specs/`
- **AND** compression stays a tracked task, gated on the covering requirement first
  becoming durable under `openspec/specs/`

#### Scenario: a live-bug guard comment is kept, corrected, and budget-trimmed

- **GIVEN** a comment in the folder that guards a cross-package divergence the code
  cannot express and points at the sibling declaration that must stay in sync
- **WHEN** the sweep processes it
- **THEN** the comment is kept within budget, with its file reference corrected to
  the declaration it actually guards, because it protects a live divergence rather
  than narrating the code

#### Scenario: the comment-only auth sweep passes security review before merge

- **GIVEN** a comment-only diff over `apps/api/src/modules/auth`
- **WHEN** the change is prepared for merge
- **THEN** it passes an auth security-review pass, and any finding that a
  compressed comment dropped an unspecced protective rationale blocks the merge
  until relocation completes

### Requirement: Comments and docstrings state facts that match current code

A comment or docstring MUST describe the code's actual current behavior. A
comment that once was accurate but now contradicts the code it sits next to
(because the code changed and the comment did not) MUST be corrected to
match, or removed if it no longer serves a purpose, during any sweep or
review that touches that file.

#### Scenario: A comment claiming a migration seeds data is corrected

- **WHEN** a schema comment states that an init migration seeds or updates a
  singleton row, but the migration has zero DML and a seed script provisions
  the row instead
- **THEN** the comment is corrected to name the seed script as the actual
  provisioning mechanism

#### Scenario: A docstring claiming a call that never happens is corrected

- **WHEN** a service's docstring lists a script as calling one of its public
  methods, but that script has always duplicated the method's logic instead
  of calling it
- **THEN** the docstring is corrected to state the duplication, not a call
  that does not exist

#### Scenario: A docstring's behavioral claim is corrected to match the code

- **WHEN** a docstring says a code path skips a step the code actually
  performs (or vice versa)
- **THEN** the docstring is corrected to match the code, not left standing
  as documentation of a stale prior state

### Requirement: All product source reaches the exemplary standard wave-by-wave

Every product source file SHALL satisfy the Exemplary Code Standard: file at
most 230 counted lines with blanks and comments excluded, functions at most 57
counted lines with blanks and comments excluded, cyclomatic complexity at most
10, cognitive complexity under 10, zero avoidable `let`/reassignment/in-place
mutation, and no silent product-configuration fallback. No product file may
remain in an `eslint.config.ts` exemption or carry an inline suppression at
campaign completion. The rollout proceeds in dependency-aware slices, and each
changed slice receives focused verification and adversarial final-blob review
before its verdict becomes terminal.

#### Scenario: A wave brings a slice to the standard

- **WHEN** a rollout wave completes for a product slice
- **THEN** every reworked product file passes ESLint with zero errors and zero warnings
  under the universal thresholds and without a slice-scoped exemption
- **AND** focused tests, typecheck, and applicable lint gates pass before the files are
  assigned final verdicts
- **AND** runtime behavior remains unchanged unless an explicit durable-spec delta
  authorizes the semantic change

#### Scenario: A supposedly permanent product exception remains

- **WHEN** a product file is listed in a permanent or grandfathered ESLint override at
  final completion
- **THEN** the universal-floor check fails
- **AND** the file MUST be refactored rather than accepted as exemplary

#### Scenario: Readability conflicts with a mechanical rewrite

- **WHEN** a proposed lint correction would obscure domain intent or create indirect,
  harder-to-follow control flow
- **THEN** the implementation is redesigned into smaller named units that satisfy the
  rule and remain understandable to a junior maintainer
- **AND** the rule is not weakened merely to preserve the original structure

#### Scenario: Rejected churn classes stay out

- **WHEN** a rollout wave proposes fixes for review findings
- **THEN** changes belonging to the ratified reject-list (`&&`-to-ternary
  rewrites, TODO purges, `.js` import consistency sweeps, empty-catch logging,
  mass magic-string extraction, blanket explicit return types) are excluded
  from the wave

### Requirement: Structural gate changes require proven measurements

Before a structural threshold, scope, or ratchet changes, the implementation
MUST enumerate every shippable enforcement option, run each option against the
same maintained-product denominator, and record the exact violation count,
affected files, command, exit status, and effective configuration. A zero result
MUST be accepted only after a planted violation proves the resolver and rule can
fail in that scope. Every measured result MUST be classified as `REAL`,
`VACUOUS`, `CONFIG`, or `NOISE`; only `REAL` results MAY justify enforcement or
debt claims.

#### Scenario: A candidate rule reports zero violations

- **WHEN** a candidate structural rule reports zero maintained-product
  violations
- **THEN** the same command is rerun with a temporary planted violation in a
  representative maintained-product file
- **AND** the planted run fails for the expected rule and file
- **AND** the clean run, planted run, effective configuration, and restored
  worktree are recorded before the zero is classified as `REAL`

#### Scenario: A candidate option is not executable

- **WHEN** a shippable candidate rule cannot resolve, crashes, silently skips
  its intended scope, or reports only parser or framework noise
- **THEN** the result is classified as `CONFIG` or `NOISE` rather than product
  debt
- **AND** the option cannot be used to claim compliance or select a threshold

### Requirement: Maintained-product structural debt ratchets monotonically to zero

The implementation MUST migrate the maintained product surface in reviewable
folder or domain slices. For every governed structural rule, a slice MUST land
its fixes and corresponding enforcement together on a green tree. New
violations MUST be rejected immediately, the recorded violation count MUST NOT
increase, and the final repository state MUST have zero maintained-product
violations, path-specific threshold overrides, and inline structural
suppressions.

#### Scenario: A compliant folder lands its enforcement

- **WHEN** a folder or domain slice reaches zero measured violations for a
  governed structural rule
- **THEN** the same change enables or tightens enforcement for that slice
- **AND** executable probes prove the compliant boundary and one-step overflow
- **AND** subsequent changes cannot add a new violation in that slice

#### Scenario: A proposed baseline increases structural debt

- **WHEN** a proposed baseline contains more governed violations than its
  predecessor
- **THEN** the ratchet fails
- **AND** a justification entry or per-file exemption cannot make that increase
  compliant

### Requirement: Obsolete paths and duplicate enforcement receive explicit dispositions

Every stale workflow, dead maintained-product path, duplicate quality tool, and
historical suppression encountered during the migration MUST receive a reviewed
`REMOVE`, `MIGRATE`, or `RETAIN` disposition. A `RETAIN` disposition MUST record
its current owner, present rationale, and executable evidence that the path or
mechanism is still used. Historical provenance alone MUST NOT justify
retention.

#### Scenario: A migration encounters an apparently unused path

- **WHEN** a maintained source path or quality mechanism has no demonstrated
  current consumer
- **THEN** it is classified as `REMOVE`, `MIGRATE`, or `RETAIN`
- **AND** `RETAIN` is accepted only with an owner, current rationale, and a
  reproducible consumer or policy probe
- **AND** unclassified obsolete code cannot remain in the completed migration

### Requirement: Strict rules require measured ownership probes

Each enabled or retained strict rule family MUST have measured repository signal,
documented scope ownership, and a planted positive probe that fails through the same
aggregate command used at completion. Where false-positive boundaries matter, the
probe suite MUST include a nearby valid negative case.

#### Scenario: A rule is configured but not reached by the gate

- **WHEN** a planted violating fixture passes the aggregate lint command because the
  file or rule is outside effective scope
- **THEN** the strictness verification fails
- **AND** the rule MUST NOT be credited as enforced

#### Scenario: A proposed rule duplicates formatter ownership

- **WHEN** an ESLint rule checks whitespace or layout already normalized by Prettier
- **THEN** the duplicate rule is not enabled
- **AND** Prettier remains the single owner of that formatting concern
