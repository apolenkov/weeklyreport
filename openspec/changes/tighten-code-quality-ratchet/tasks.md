# Tasks — Tighten the Code-Quality Ratchet One Notch

Plan-only. Implementation is deferred — these tasks are the execution plan, not
work to start now (mirroring `ratchet-lint-to-strict`). Each cluster commits
separately and lands the gate green before the next. No mass-disable, no
threshold-raise-back to force green.

Model split: Sonnet (manual literal/size fixes) · Opus (review of clusters whose
fix changes structure). Budget per cluster; no global ceiling.

## 0. Preconditions

- [ ] R0a The ratchet is complete: `eslint.config.ts` enforces `max-lines: 300`,
      `complexity: 20`, `sonarjs/cognitive-complexity: 15`, `no-explicit-any:
    error`, and the R3a grandfather blocks are EMPTY (verified at authoring).
- [ ] R0b This change's spec delta validates (`openspec validate
    tighten-code-quality-ratchet --strict`).

## 1. max-lines 300 → 250 (structural, autofix-free)

- [ ] R1a Lower `max-lines` to 250 in `eslint.config.ts` (keep `skipBlankLines:
    true`, `skipComments: true`). Do NOT touch `complexity` or
      `cognitive-complexity`.
- [ ] R1b Measure the real (skipBlankLines + skipComments) 250–300 cohort with the
      new threshold; repopulate the now-EMPTY `max-lines` grandfather block with
      exactly those files so the gate lands green.
- [ ] R1c Drain the grandfather block one wave at a time: per file, either split
      below 250 (prefer many small single-purpose units) OR move to the
      justified-permanent exempt block with a one-line reason (split would hurt
      clarity / break memoization). Never raise the threshold back.
- [ ] R1d Each wave lands `pnpm lint` + `pnpm typecheck` + `pnpm test` green
      before the next wave. Opus review for any wave that restructures a file.

## 2. no-magic-numbers (TS-aware, manual — no autofix)

- [ ] R2a Enable `@typescript-eslint/no-magic-numbers` as `error` with: `ignore:
    [-1, 0, 1, 2]`, `enforceConst: true`, `ignoreArrayIndexes: true`,
      `ignoreEnums: true`, `ignoreReadonlyClassProperties: true`,
      `ignoreTypeIndexes: true`, `ignoreNumericLiteralTypes: true`. Reuse the
      standard's exempt set (tests, e2e, `prisma/generated`, `prisma/seed*.ts`,
      `*.config.ts`) plus one-off operational scripts.
- [ ] R2b Because the rule has NO autofix, there is no isolated `eslint --fix`
      commit: fix every firing by hand, lifting the literal to a named `const` /
      `enum` / config value at the top of its module (Sonnet tier).
- [ ] R2c Follow the fix-first ladder: fix code → per-site `eslint-disable` only
      for a genuine false positive with a written reason → exempt only as a last
      resort, recorded in the spec. No mass-disable.
- [ ] R2d Land per-cluster green (`pnpm lint` + `typecheck` + `test`); counts
      measured per cluster, no global ceiling.

## 3. Magic-string policy

- [ ] R3a Flip `sonarjs/no-duplicate-string` from `off` to `error` (it is already
      in the spread recommended set) for the repeated-string subset; carve out
      tests where repeated fixture strings are inherent, per the existing sonarjs
      test-file override pattern.
- [ ] R3b Fix repeated-string firings by lifting to a shared named constant; the
      one-off-string case is the documented review policy (lift to
      `const`/`enum`/config), not a lint error.
- [ ] R3c Land green per cluster, fix-first ladder, no mass-disable.

## 4. Close-out

- [ ] R4a Confirm the `max-lines` grandfather block is EMPTY again (every cohort
      file split or justified-permanent exempt), and `no-magic-numbers` +
      `no-duplicate-string` are `error` with zero remaining firings.
- [ ] R4b Full gate green: `pnpm lint` + `pnpm typecheck` + `pnpm test` +
      `pnpm build`. Every per-site disable carries a reason; no threshold was
      raised back to force green.
