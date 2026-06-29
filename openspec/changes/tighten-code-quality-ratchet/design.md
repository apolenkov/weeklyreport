# Design — Tighten the Code-Quality Ratchet One Notch

## Context

The ratchet (`declare-lint-max-strictness` → `ratchet-lint-to-strict`) is done:
the standard is the spec source of truth, and `eslint.config.ts` enforces it with
EMPTY grandfather blocks. This change is a deliberate, small one-notch tightening,
not a new regime. It is plan-only; the config edits and fixup waves are deferred
execution, exactly as the Phase-3 ratchet change deferred its own work.

## Decisions

### 1. `max-lines` 300 → 250, as a MODIFIED requirement (not a new one)

OpenSpec MODIFIED replaces a requirement in full, matched by its exact header
`Size and complexity thresholds are pinned with exempt directories`. So the delta
restates `complexity` and `cognitive-complexity` even though only `max-lines`
moves — that is a format constraint, not a second change.

- Threshold options preserved: `skipBlankLines: true`, `skipComments: true`.
- `complexity` restated as **20**, not the prior spec's ≤ 10. The live config is
  `complexity: 20` (community/ESLint default, documented inline there as the
  intentional value); the ≤ 10 in the old spec was stale drift. Writing the true
  number inside a tightening change avoids enshrining a value the config
  contradicts. This is a documentation correction, NOT a change to the rule.
- The old parenthetical enumerating global defaults (`files 250–300, cyclo ≤ 5,
cogn ≤ 8`) is dropped: it was already stale, and it goes incoherent once the
  repo itself drops to 250. The "repo config wins" sentence carries the intent
  without a second wrong number.

### 2. Magic numbers via lint; magic strings via policy + one mechanical subset

- **Numbers:** `@typescript-eslint/no-magic-numbers` (the TS-aware extension —
  it understands enums, numeric-literal types, and `readonly` class fields, which
  the core rule mishandles). Options chosen to match the repo's standing
  exemptions in `~/.claude/rules/code-style.md`:
  - `ignore: [-1, 0, 1, 2]` — the "obvious arithmetic" carve-out.
  - `enforceConst: true` — a lifted literal must be `const`, not `let`/`var`.
  - `ignoreArrayIndexes: true` — `arr[2]` is an index, not a magic number.
  - `ignoreEnums`, `ignoreReadonlyClassProperties`, `ignoreTypeIndexes`,
    `ignoreNumericLiteralTypes` — the idiomatic TS spots where a literal IS the
    named declaration, so flagging it would force a pointless indirection.
  - Exempt dirs reuse the standard's set (tests, e2e, `prisma/generated`,
    `prisma/seed*.ts`, `*.config.ts`) plus one-off operational scripts — same
    "tests and one-off scripts" carve-out the global rule names.
- **Strings:** there is deliberately no TS-aware no-magic-strings rule; inventing
  a custom one would be overengineering. So:
  - One-off inline strings → documented review policy (lift to `const`/`enum`/
    config). UI copy is governed separately by the repo's English-only-UI rule
    and is data, not a magic literal.
  - Repeated strings → `sonarjs/no-duplicate-string`, which is already in the
    spread sonarjs recommended set but defaults to `off`; flip it to `error`.
    This catches the mechanical, measurable subset without a bespoke rule.

### 3. Ratchet, not big-bang — reuse the existing discipline

The standard already owns the ratchet requirements (fix-first ladder, per-cluster
gate, cost-tiered models, ramp-one-rule-at-a-time). This change does NOT restate
or weaken them; it adds one requirement that scopes them to this notch and pins
the mechanism:

- **`max-lines` 250:** repopulate the now-EMPTY grandfather block with the
  pre-existing 250–300 cohort so the gate stays green the moment the threshold
  drops, then drain it one wave at a time (split, or move to the
  justified-permanent exempt block with a one-line reason). Never raise the
  threshold back to clear a file.
- **`no-magic-numbers` is NOT autofixable** — so the existing "isolated
  autofix-first cluster" rung does not apply. Every firing is a manual Sonnet-tier
  fix under the fix-first ladder; Opus review only where a fix changes structure.
- **`no-duplicate-string`** ramps off → error as its own wave.
- Counts measured at execution; per-cluster budget; no global ceiling.

## Measurements (orientation only, not pinned in the spec)

Read-only `wc -l` on hand-written src `*.ts`/`*.tsx` (excluding tests, e2e,
generated, seeds, config): ~25 files in the raw 250–299 band. This is an upper
bound — `skipBlankLines` + `skipComments` lowers the real count, and `dist/` /
test-utils drop out under ignores — so the true 250–300 cohort is roughly ~20
files. Magic-number / repeated-string firing counts are not estimated here; they
are measured per cluster at execution, consistent with the "no global ceiling"
requirement.

## Risks

- **Lower-risk than the original ratchet.** `max-lines` is purely structural;
  splitting a file changes no behavior. `no-magic-numbers` fixes are
  name-extractions, also behavior-preserving when done by hand.
- **Main risk is over-splitting** to satisfy 250 (the overnight refactor army
  proved blind splits pass the gate but break memoization/behavior). Mitigation:
  the justified-permanent exempt escape hatch with a one-line reason, and the
  per-cluster gate + review, both inherited from the existing ratchet.
- **`no-duplicate-string` threshold** may flag intentional repeats; those follow
  the fix-first ladder (lift to const, or per-site disable with a reason only for
  a genuine false positive).
