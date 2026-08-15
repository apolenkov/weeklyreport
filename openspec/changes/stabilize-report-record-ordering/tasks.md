## 1. API read contract

- [x] 1.1 Order the shared report-section `items`, `risks`, and `decisions` relations by ascending durable `stableId`.
- [x] 1.2 Add a focused API contract regression covering all three ordered relations and preserving existing nested relation data.

## 2. Canonical seed identity

- [x] 2.1 Assign explicit deterministic primary and stable identities to simple-profile item, risk, and decision rows, including the previously random decision.
- [x] 2.2 Assign explicit deterministic stable identities to every additional item, risk, and decision written by the composed full-profile overlay.
- [x] 2.3 Add seed regressions proving two equivalent simple/full constructions produce identical record identities and ordered record sets.

## 3. Runtime authority boundary

- [x] 3.1 Preserve exact genesis equality and add bounded field-level sealed/fresh diagnostics without changing comparison semantics.
- [x] 3.2 Add a negative continuation regression where controls remain identical but reordered visible record text is rejected before any action.
- [x] 3.3 Add a source-controlled fresh-child continuation regression that accepts matching ordinal decision lineage and rejects swapped lineage before execution.

## 4. Verification and evidence

- [x] 4.1 Run focused Vitest suites for the API include, seed identities, and continuation genesis, plus changed-file ESLint.
- [ ] 4.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; record exact outcomes against the committed source.
- [ ] 4.3 Commit the complete repair atomically, prove a clean branch/HEAD/tree snapshot, and run the exact-SHA full-profile continuation canary.
- [ ] 4.4 Record the canary source, parent grant, independent reset/reseed, fresh-genesis acceptance, frontier continuation, terminal verdict, and cleanup evidence in the external archive.
