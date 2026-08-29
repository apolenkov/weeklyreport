# Quality Program — how this repo is engineered and verified

A summary of the quality system built into WeeklyReport: what is enforced,
what has been measured, and what the ongoing program is. Every claim below is
verifiable in this repository (commands, configs, and specs are linked).

## Enforced gates (active today)

- **Strict type-aware lint, zero warnings.** `pnpm lint` = ESLint
  (`strictTypeChecked` + `stylisticTypeChecked` + sonarjs + unicorn + import
  boundaries) + stylelint + Prisma schema lint + `depcruise` + `knip`.
  "Done" means `--max-warnings 0` with no per-file exemption
  (`eslint.config.ts` holds only documented JUSTIFIED PERMANENT entries).
  `scripts/gates/orchestrator/lint-gate.ts` runs every configured check in one pass and reports each
  PASS/FAIL, so one failing check can no longer hide the ones behind it.
- **Acyclic architecture.** The dependency-cruiser gate measures the current
  graph and rejects every forbidden edge or runtime import cycle. The exact
  module/edge denominator is live command output, not a durable documentation
  constant; `pnpm depcruise --output-type json` is the source. The historical
  2026-07 burn-down started from 41 cycles. Spec:
  `openspec/specs/directory-architecture-standard/`.
- **Dead-export gate.** knip fails the push on any exported symbol without an
  importer.
- **Type coverage floors** per package: `packages/shared` 100%, `packages/ui`
  100%, `apps/api` 99.98%, and `apps/web` 99.8%.
- **Hooks as the merge gate.** pre-commit: lint-staged; pre-push: typecheck,
  full lint, format check, and the colocated unit suites.
- **Spec-first workflow.** Behavior changes start as OpenSpec changes;
  the durable requirements validate green (`openspec validate --specs`).

## Measured, not asserted

- **Whole-repo review, per-file verdicts.** 2026-07-17: all 1166 source files
  reviewed by a multi-model pipeline (batched reviewers, adversarial
  verification of every major finding, cross-vendor council synthesis).
  Review brief and per-file evidence: `~/work/customreport-archive/2026-07-30-exhaustive-style-audit/CODEX-REVIEW-BRIEF-2026-08-03-COMPLETE.md`
  (verdicts: 97 exemplary / 943 good / 124 needs-attention / 2 defect at scan
  time). Its entire actionable backlog was implemented and archived.
- **Exemplary standard rollout (ongoing).** Campaign to bring every file to
  `docs/exemplary-code-standard.md` (file ≤ 230 lines, functions ≤ 57,
  cyclomatic complexity ≤ 10, cognitive complexity < 10, zero mutation, no
  silent config fallbacks).
  Waves are implemented by orchestrated agent lanes, each wave passes two
  independent adversarial reviews plus the full gate before commit.
  The completed rollout is preserved at
  `openspec/changes/archive/2026-08-04-repair-exhaustive-audit-exemplary-quality/`.

## Architecture and safety rails

- Monorepo with enforced module boundaries (import zones per slice; public
  API of a module is its barrel; cross-module internals are lint errors).
- Load-bearing invariants are spec-documented and test-gated (e.g. every
  tRPC procedure must use one of 8 canonical role-middleware builders,
  enforced by reference identity in a coverage test).
- Destructive-operation guard for production databases; env config is
  fail-loud (required Zod schemas, no silent defaults).
- Product tests are colocated with their owning package. Test files keep
  failure-prevention rules but do not inherit production structural,
  complexity, or immutability budgets.

## Reading order (for a reviewer)

1. `docs/exemplary-code-standard.md` — the bar.
2. `eslint.config.ts` — the bar, mechanized.
3. `openspec/specs/` — behavior as versioned requirements.
4. `openspec/changes/archive/2026-08-04-repair-exhaustive-audit-exemplary-quality/`
   — the archived rollout plan and task ledger.
