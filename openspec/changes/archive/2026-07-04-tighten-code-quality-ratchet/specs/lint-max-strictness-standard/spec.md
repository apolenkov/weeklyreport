# lint-max-strictness-standard Specification (delta)

This delta tightens the existing, already-completed code-quality ratchet one
notch, under the same capability `lint-max-strictness-standard` (it extends the
standard; it does NOT create a new capability). It MODIFIES the size/complexity
threshold requirement to lower `max-lines` from 300 to 250, and ADDs two new
requirements: a magic-number / magic-string literal policy, and the ratchet
execution discipline that brings the codebase under the new thresholds without a
big-bang.

## MODIFIED Requirements

### Requirement: Size and complexity thresholds are pinned with exempt directories

The standard MUST pin `max-lines` at 250 with `skipBlankLines: true` and
`skipComments: true`; cyclomatic complexity (`complexity`) at ≤ 20; and cognitive
complexity (`sonarjs/cognitive-complexity`) at ≤ 15. These repo thresholds
supersede the global CLAUDE.md / `code-style.md` defaults via the global "repo
config wins" rule — the live config is the source of truth for the numbers. The
size, complexity, and JSDoc rules MUST exempt: tests (`*.test.*`, e2e), generated
(`prisma/generated`), seeds (`prisma/seed*.ts`), and config (`*.config.ts`).

The `max-lines` change from 300 to 250 is the only threshold this notch moves.
`complexity` (20) and `sonarjs/cognitive-complexity` (15) are restated here only
because a MODIFIED requirement replaces the prior one in full; their values are
unchanged from the live config and are NOT touched by this change. The prior
revision of this requirement carried a stale cyclomatic figure (≤ 10) and a stale
parenthetical enumeration of the global defaults; both are corrected to the live
values here.

#### Scenario: a long generated file is not flagged for size

- **WHEN** the standard enforces `max-lines`
- **THEN** a 600-line file under `prisma/generated` is not reported
- **AND** a 280-line hand-written file under `apps/web/src` is reported
- **AND** the threshold counts neither blank lines nor comments

#### Scenario: the lowered threshold reports a file the old one allowed

- **WHEN** a hand-written source file measures 270 real (non-blank, non-comment)
  lines
- **THEN** it is reported under the 250 threshold
- **AND** it would NOT have been reported under the prior 300 threshold
- **AND** the same file under `*.test.*` / e2e / `prisma/generated` /
  `prisma/seed*.ts` / `*.config.ts` is still exempt

## ADDED Requirements

### Requirement: Magic numbers and repeated string literals are lifted to named constants

The standard MUST enable `@typescript-eslint/no-magic-numbers` as `error` (the
TS-aware variant, which understands enums, numeric-literal types, and `readonly`
class fields), and MUST enforce a documented magic-string policy: a literal
carrying meaning in logic is lifted to a named `const`, `enum`, or config value.
The numeric rule MUST be configured with the repo's established exemptions from
`~/.claude/rules/code-style.md`: `ignore: [-1, 0, 1, 2]` (the obvious-arithmetic
set), `enforceConst: true`, `ignoreArrayIndexes: true`, `ignoreEnums: true`,
`ignoreReadonlyClassProperties: true`, `ignoreTypeIndexes: true`, and
`ignoreNumericLiteralTypes: true`. The rule MUST reuse the standard's existing
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

### Requirement: The 250-line and magic-literal tightening is achieved by ratchet, never by big-bang

The tightening MUST reuse the standard's existing ratchet discipline — the
fix-first escalation ladder, the per-cluster `pnpm lint` + `typecheck` + `test`
gate, and the cost-tiered model split — rather than restating or weakening it.
Bringing the codebase under the new thresholds MUST proceed one cluster at a
time. The previously EMPTY `max-lines` grandfather block in `eslint.config.ts`
MUST be repopulated with the pre-existing 250–300 cohort as a documented
grandfather list, then drained one wave at a time, each wave landing the gate
green before the next; a file is moved to the justified-permanent exempt block
(with a one-line reason) only when a split would hurt clarity, never by raising
the threshold back.

Because `@typescript-eslint/no-magic-numbers` is NOT autofixable, the
"isolated autofix-first cluster" rung of the existing ratchet requirement does
NOT apply to it: every firing is a manual (Sonnet-tier) judgment fix under the
fix-first ladder, with Opus review reserved for clusters whose fix changes
structure. The numeric rule and `sonarjs/no-duplicate-string` MUST each be
ramped from `off`/grandfathered to `error` with their own fixup wave, never the
whole tightening at once. Violation counts MUST be measured at execution time
with a per-cluster budget and no global ceiling.

#### Scenario: the 250–300 cohort is grandfathered then drained per wave

- **WHEN** `max-lines` is lowered to 250
- **THEN** the pre-existing files between 250 and 300 real lines are listed in
  the grandfather block so the gate stays green on land
- **AND** each subsequent wave splits or permanently-exempts a batch and lands
  `pnpm lint` + `typecheck` + `test` green before the next wave starts
- **AND** no file clears the gate by raising `max-lines` back toward 300

#### Scenario: the non-autofixable magic-number rule skips the autofix rung

- **WHEN** `@typescript-eslint/no-magic-numbers` is ramped to `error`
- **THEN** there is no isolated `eslint --fix` commit for it, because the rule
  has no autofix
- **AND** each firing is fixed manually by lifting the literal to a named
  constant under the fix-first ladder
- **AND** the per-cluster gate and cost-tiered model split from the existing
  ratchet requirements still apply unchanged
