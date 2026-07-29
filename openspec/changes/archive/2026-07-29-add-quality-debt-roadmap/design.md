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

| ID  | Accepted decision                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| N1  | Classify all ESLint blocks from effective configuration; preserve useful policy and enforcement.                             |
| N2  | Use one normative roadmap and independent implementation changes.                                                            |
| N3  | Eliminate all nine measured cycle clusters and reach baseline zero.                                                          |
| N4  | Adjudicate every suppression; retain only minimal, owned, reasoned, planted exceptions.                                      |
| N5  | Execute debt work in order: cycles, suppressions, policy scopes.                                                             |
| N6  | Land one connected cycle cluster with its seam, evidence, decrement, push, and checkpoint.                                   |
| N7  | Feature API cleanup is allowed; type dumps, barrel indirection, duplicated contracts, and weaker depcruise are forbidden.    |
| N8  | Cycle cleanup may explicitly change wire contracts and product behavior.                                                     |
| N9  | The implementation agent may decide cycle-driven semantics when OpenSpec and independent evidence are updated.               |
| N10 | Architectural coherence takes priority over stale specs, behavior, and tests; affected contracts must be updated explicitly. |
| N11 | MVP architecture-first cutovers may break compatibility without adapters.                                                    |
| N12 | Existing persisted production rows are not a design constraint; this does not authorize an unnamed live-database operation.  |
| N13 | MVP data is disposable; repository resets and every affected seed entrypoint must follow the new architecture.               |
| N14 | The public seed selector exposes exactly `minimal`, `demo`, `full`, and `stress`.                                            |
| N15 | Every profile has capability, bounded-count, stable-ID, and journey proof.                                                   |
| N16 | Profiles form a monotonic capability ladder; stress preserves full and increases volume.                                     |
| N17 | Seed-profile unification remains an independent implementation change.                                                       |
| N18 | The owner approved the normative roadmap and all four implementation changes.                                                |

## Final measured outcome

```text
surface               start                    completed
--------------------  -----------------------  -----------------------------
type cycles           27 / 9 clusters          0 / 0
suppressions          126 raw / 115 real       72 retained, 115/115 ruled
ESLint files blocks   26 unclassified          26 classified, 0 debt/duplicate
seed profiles         overlapping size tiers   4 monotonic named profiles
floor                 842 / 929 at execution   851 / 930
```

The nonzero final counts are proved policy, not incomplete work. The 72
retained suppressions fail under their named rules when the exact directive is
removed. The 26 retained ESLint scopes split into 6 enforcement, 14 policy, and
6 specialization blocks with 32 matching/nonmatching planted checks.

## Source precedence

For every slice: current source and direct command output decide the observed
state; active OpenSpec decides the intended contract; tests prove selected
behavior but do not override a false source claim. The HTML report,
`roadmap.json`, and `HANDOFF.md` are resumability views, not competing normative
specifications.
