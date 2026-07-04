# Tasks — Tighten the Code-Quality Ratchet One Notch

Plan-only. Implementation is deferred — these tasks are the execution plan, not
work to start now (mirroring `ratchet-lint-to-strict`). Each cluster commits
separately and lands the gate green before the next. No mass-disable, no
threshold-raise-back to force green.

Model split: Sonnet (manual literal/size fixes) · Opus (review of clusters whose
fix changes structure). Budget per cluster; no global ceiling.

> **STATUS 2026-07-04 (night) — ALL SECTIONS COMPLETE (15/15).** §1: the
> 300→250 notch landed and the 30-file grandfather cohort was drained
> (ab049e76 … 97c5875b). §2: `no-magic-numbers` is `error` repo-wide — 398
> firings across 98 files hand-lifted in 7 waves (shared time vocabulary at
> `packages/shared/src/time.ts`). §3: `no-duplicate-string` is `error` — 54
> firings triaged, ~39 real-code lifts in one wave, fixture/vendored/ops
> carve-outs recorded in the config. §4 close-out gate ran green including
> `pnpm build`. Ready to archive.

## 0. Preconditions

- [x] R0a The ratchet is complete: `eslint.config.ts` enforces `max-lines` (300
      at authoring, 250 since R1a), `complexity: 20`,
      `sonarjs/cognitive-complexity: 15`, `no-explicit-any: error`, and the
      R3a grandfather blocks are EMPTY (verified at authoring).
- [x] R0b This change's spec delta validates (`openspec validate
tighten-code-quality-ratchet --strict`).

## 1. max-lines 300 → 250 (structural, autofix-free)

- [x] R1a Lower `max-lines` to 250 in `eslint.config.ts` (keep `skipBlankLines:
true`, `skipComments: true`). Do NOT touch `complexity` or
      `cognitive-complexity`.
- [x] R1b Measure the real (skipBlankLines + skipComments) 250–300 cohort with the
      new threshold; repopulate the now-EMPTY `max-lines` grandfather block with
      exactly those files so the gate lands green. (30 files grandfathered.)
- [x] R1c Drain the grandfather block one wave at a time: per file, either split
      below 250 (prefer many small single-purpose units) OR move to the
      justified-permanent exempt block with a one-line reason (split would hurt
      clarity / break memoization). Never raise the threshold back.
- [x] R1d Each wave lands `pnpm lint` + `pnpm typecheck` + `pnpm test` green
      before the next wave. Opus review for any wave that restructures a file.

## 2. no-magic-numbers (TS-aware, manual — no autofix)

- [x] R2a Enable `@typescript-eslint/no-magic-numbers` as `error` with: `ignore:
[-1, 0, 1, 2]`, `enforceConst: true`, `ignoreArrayIndexes: true`,
      `ignoreEnums: true`, `ignoreReadonlyClassProperties: true`,
      `ignoreTypeIndexes: true`, `ignoreNumericLiteralTypes: true`. Reuse the
      standard's exempt set (tests, e2e, `prisma/generated`, `prisma/seed*.ts`,
      `*.config.ts`) plus one-off operational scripts. (Also exempt with
      recorded reasons: histogram-bucket catalogues in metrics files, vendored
      shadcn primitives, api test-utils.)
- [x] R2b Because the rule has NO autofix, there is no isolated `eslint --fix`
      commit: fix every firing by hand, lifting the literal to a named `const` /
      `enum` / config value at the top of its module (Sonnet tier). (398
      firings / 98 files drained in 7 waves; shared time-constant vocabulary
      added at `packages/shared/src/time.ts`.)
- [x] R2c Follow the fix-first ladder: fix code → per-site `eslint-disable` only
      for a genuine false positive with a written reason → exempt only as a last
      resort, recorded in the spec. No mass-disable. (Zero new per-site
      disables were needed.)
- [x] R2d Land per-cluster green (`pnpm lint` + `typecheck` + `test`); counts
      measured per cluster, no global ceiling. (Each wave committed green:
      typecheck + full api 1394 / web 1511 / shared 348 suites.)

## 3. Magic-string policy

- [x] R3a Flip `sonarjs/no-duplicate-string` from `off` to `error` (it is already
      in the spread recommended set) for the repeated-string subset; carve out
      tests where repeated fixture strings are inherent, per the existing sonarjs
      test-file override pattern. (Also carved out with recorded reasons:
      mock-data fixture catalogues, vendored shadcn sidebar, one-off ops
      scripts, config override lists.)
- [x] R3b Fix repeated-string firings by lifting to a shared named constant; the
      one-off-string case is the documented review policy (lift to
      `const`/`enum`/config), not a lint error. (54 firings measured; ~39 in
      real code lifted across 15 files, the rest exempted as fixture/vendored/
      ops data.)
- [x] R3c Land green per cluster, fix-first ladder, no mass-disable. (Zero
      per-site disables needed; suites green.)

## 4. Close-out

- [x] R4a Confirm the `max-lines` grandfather block is EMPTY again (every cohort
      file split or justified-permanent exempt — block deleted in 97c5875b),
      and `no-magic-numbers` + `no-duplicate-string` are `error` with zero
      remaining firings (confirmed by repo-wide census before each flip).
- [x] R4b Full gate green: `pnpm lint` + `pnpm typecheck` + `pnpm test` +
      `pnpm build`. Every per-site disable carries a reason; no threshold was
      raised back to force green. (Gate run 2026-07-04 night: lint clean,
      typecheck clean, api 1394 / web 1511 green, turbo build 5/5.)
