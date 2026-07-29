# Tasks

## 1. Shared and UI packages

- [x] Inventory and adjudicate every suppression under `packages/shared` and
      `packages/ui`; remove, replace, or retain with proof.

## 2. API

- [x] Adjudicate production API suppressions, including process bootstrap,
      infrastructure boundaries, mutable lifecycle state, external payloads,
      and deterministic algorithms.
- [x] Adjudicate API test suppressions, especially Vitest asymmetric matchers,
      unbound mocks, AST traversal, and integration harnesses.

## 3. Web

- [x] Adjudicate production web suppressions, including React refs/effects,
      autofocus, scroll-region accessibility, legacy reads, and deterministic
      ordering.
- [x] Adjudicate web test file-wide DOM assertion suppressions and narrow or
      remove each independently.

## 4. Prisma, scripts, tools, and e2e

- [x] Adjudicate destructive-script, process-spawn, seed, catalogue, status
      gate, and e2e suppressions under their real effective configurations.

## 5. Ledger and verification

- [x] Store all 126 starting observations (115 directives and 11
      measurement-noise records) with source fingerprint, verdict, reason,
      owner where applicable, proof, and implementation commit.
- [x] Add a main-gate ledger check that rejects missing live directives,
      resolved stale entries, and retained entries without proof metadata.
- [x] Run planted production-config probes for every retained rule/shape family.
- [x] Re-run `pnpm catalogue`, update the exact `liveSuppressions` baseline, and
      prove zero unadjudicated or unjustified entries.
- [x] Run `pnpm lint:eslint`, `pnpm lint:exemplary-floor`, targeted tests,
      `pnpm lint`, and `pnpm typecheck`.
- [x] Run `openspec validate remove-unjustified-suppressions --strict`.
