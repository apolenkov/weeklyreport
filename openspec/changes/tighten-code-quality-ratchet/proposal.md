# Tighten the Code-Quality Ratchet One Notch

## Why

The max-strictness ratchet is complete: `eslint.config.ts` already enforces
`max-lines: 300` (skipBlankLines + skipComments), `complexity: 20`,
`sonarjs/cognitive-complexity: 15` (error), and `no-explicit-any: error`, and the
R3a grandfather blocks are EMPTY — every file is under budget. That is the right
moment to tighten one notch toward the enterprise standard, while the cost of the
move is small and the gate is green.

This change pulls two more rungs from `~/.claude/rules/code-style.md` into the
durable standard: a smaller file budget (250 lines) and a no-magic-literal policy
(numbers via lint, repeated strings via lint, one-off strings via review). Both
extend the existing `lint-max-strictness-standard` capability; neither introduces
a new capability.

## What Changes

- **Lower `max-lines` 300 → 250** (keep `skipBlankLines: true` +
  `skipComments: true`). This is a MODIFIED delta on the existing
  "Size and complexity thresholds are pinned with exempt directories"
  requirement; `complexity` (20) and `cognitive-complexity` (15) are unchanged
  and only restated because MODIFIED replaces the requirement in full.
- **Enable `@typescript-eslint/no-magic-numbers`** (TS-aware) as `error`, with
  the repo's established exemptions: `ignore: [-1, 0, 1, 2]`, `enforceConst`,
  `ignoreArrayIndexes`, `ignoreEnums`, `ignoreReadonlyClassProperties`,
  `ignoreTypeIndexes`, `ignoreNumericLiteralTypes`; reusing the standard's exempt
  set (tests, e2e, generated, seeds, config) plus one-off scripts.
- **Add a magic-string policy.** There is no TS-aware no-magic-strings rule, so
  one-off strings are a documented lift-to-`const`/`enum`/config review policy,
  and the repeated-string subset is enforced mechanically by flipping
  `sonarjs/no-duplicate-string` (in the recommended set but currently `off`) to
  `error`.
- **Add the ratchet execution plan** for this notch: repopulate the now-empty
  `max-lines` grandfather block with the pre-existing 250–300 cohort, then drain
  it one wave at a time; ramp `no-magic-numbers` (non-autofixable → all manual)
  and `no-duplicate-string` each with their own fixup wave, reusing the existing
  fix-first ladder, per-cluster gate, and cost-tiered model split.

## Non-goals

- No change to `complexity` (20) or `sonarjs/cognitive-complexity` (15); this
  notch moves only `max-lines` and adds the magic-literal rules.
- No `eslint.config.ts` edit or any code fix in this change — it is plan-only.
  The config flips and fixup waves are deferred execution, mirroring how the
  Phase-3 ratchet change deferred its work.
- No new lint capability, no reopening of the inherited a11y carve-outs, no
  big-bang enablement.

## Capabilities

### Modified Capabilities

- `lint-max-strictness-standard`: lower the `max-lines` threshold to 250; add a
  magic-number / magic-string literal requirement; add the ratchet execution
  discipline that brings the codebase under the tightened thresholds without a
  big-bang.

## Impact

- `eslint.config.ts` (at execution): `max-lines` 300 → 250; add
  `@typescript-eslint/no-magic-numbers` with options; flip
  `sonarjs/no-duplicate-string` off → error; repopulate the `max-lines`
  grandfather block.
- Source files in the 250–300 real-line cohort (~20 hand-written `*.ts`/`*.tsx`
  under `apps/*`, `packages/*`; exact count measured at execution) split or
  permanently-exempted one wave at a time.
- Magic-number / repeated-string firings across the codebase, fixed by lifting
  literals to named constants; counts measured per cluster at execution.
- No prisma, no schema, no runtime behavior change — lint surface and refactors
  only.
