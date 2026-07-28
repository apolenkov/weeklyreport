# Design

## Measured graph

The runtime graph (`pnpm depcruise`) currently exits 0. The pre-compilation
graph used by `pnpm lint:type-cycles` contains 27 violations:

| Cluster                            | Violations | Modules |
| ---------------------------------- | ---------: | ------: |
| admin/period/organization settings |          6 |      11 |
| dashboard model                    |          5 |       6 |
| SDLC pipeline                      |          5 |       5 |
| unified activity                   |          4 |       4 |
| lead-form section composition      |          3 |       4 |
| periods action/table               |          1 |       2 |
| record comments                    |          1 |       2 |
| reopen request card                |          1 |       2 |
| slide grid                         |          1 |       2 |

## Slice algorithm

For each cluster:

```text
current graph
    |
    v
identify semantic owner and dependency direction
    |
    v
move contract/behavior to that owner
    |
    +--> update wire/schema/seed specs when affected
    |
    v
targeted behavior proof + runtime graph + pre-compilation graph
    |
    v
exact baseline decrement + checkpoint + commit + push
```

The seam must make the module on the lower architectural layer independently
understandable. Moving declarations without ownership, creating a neutral
`types.ts` dump, or re-exporting through another barrel is not a seam.

## Semantic authority

Architectural coherence has priority over current behavior when a cluster
reveals that behavior has no coherent owner. The slice records the selected
contract in an OpenSpec delta and updates all consumers and tests. Rewritten
tests alone are not proof; a targeted test must exercise the new owning
boundary, and existing product journeys affected by the cutover must run.

## Data policy

This is an MVP with disposable non-production data. Schema reshaping and reset
are allowed, but `prisma/_destructive-guard.ts` remains unchanged unless a
separate linked change says otherwise. Any cycle slice changing persisted or
wire data depends on the seed-profile change and updates all four profile
manifests and smoke journeys before the slice completes.
