# Design

## Adjudication record

Each source record is keyed by normalized repository path. Adjudication stores
the verdict and concise source evidence; an absent claim is overturned rather
than inferred.

## Landing strategy

Confirmed findings are grouped by semantic risk:

1. local test/tooling corrections with no product-contract change;
2. local product fixes with direct regression tests;
3. shared-schema and cross-feature refactors with an explicit migration plan.

Every slice must keep the tree green and update the roadmap record only after
the claimed behavior has been verified.
