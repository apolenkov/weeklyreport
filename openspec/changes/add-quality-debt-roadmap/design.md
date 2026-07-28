# Design

## Domain vocabulary

| Term            | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| cycle violation | one `no-circular` result in the pre-compilation graph              |
| cycle cluster   | a connected component containing one or more cycle violations      |
| suppression     | a live inline `eslint-disable*` directive counted by the catalogue |
| policy scope    | an ESLint `files:` block that enables or specializes enforcement   |
| relaxation debt | a scope that disables, weakens, duplicates, or obscures policy     |
| seed profile    | one deterministic product dataset selected by public name          |

Raw counts are observations, not interchangeable defect counts. A policy scope
may be necessary; a suppression may be the smallest truthful expression of an
external type mismatch; multiple cycle violations may share one architectural
seam.

## Campaign graph

```text
add-quality-debt-roadmap
|
+-- refactor-type-cycle-clusters ------ target: 27 -> 0
|   `-- refactor-seed-profile-ladder -- dependency when data contracts change
+-- remove-unjustified-suppressions --- target: 0 unadjudicated
`-- refactor-eslint-policy-scopes ----- target: 0 unclassified/debt scopes
```

Implementation order is cycles, suppressions, then ESLint scopes. Seed-profile
work is independent and may begin before a cycle slice needs a data-contract
cutover, but it does not reorder the three debt surfaces.

## Decision record

- Architectural coherence may change public feature APIs, wire contracts,
  behavior, schemas, and current durable specs when the new contract is made
  explicit and all affected evidence is updated.
- Breaking MVP cutovers need no compatibility adapter or preservation of
  accumulated rows. Repository-owned schema reset is allowed; the destructive
  guard remains load-bearing and unnamed external databases remain out of scope.
- Each connected cycle cluster lands alone with its seam, tests, exact baseline
  decrement, report checkpoint, commit, and push.
- Every suppression and every ESLint `files:` block receives an evidence-backed
  classification. Completion is not a promised raw zero.
- Seed data forms the monotonic `minimal`, `demo`, `full`, `stress` ladder and
  is proved by capabilities, counts, stable identifiers, and smoke journeys.

## Source precedence

For every slice: current source and direct command output decide the observed
state; active OpenSpec decides the intended contract; tests prove selected
behavior but do not override a false source claim. The HTML report,
`roadmap.json`, and `HANDOFF.md` are resumability views, not competing normative
specifications.
