# Proposal

## Why

A seed restore can retain illegal pause metadata, overwrite a first stage owner, and produce malformed deterministic IDs at the already-promised expanded product range. Existing profile validation also needs to prove every required identity, and seed child processes need one run reference. D37-F09 checks current public producers before each correction.

## What Changes

- Clear omitted pause reason at the existing item upsert boundary.
- Preserve existing assignment ownership on the upsert update path and intersect generated status slots with effective ownership.
- Use one capacity-bounded fixed-width ID layout while retaining existing valid bytes.
- Validate complete manifest-owned identity scope and pass one validated ISO instant to every profile child.
- Preserve CLI error/cleanup boundaries only where current-contract RED justifies a correction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `record-status-derivation`: deterministic seed restoration clears pause metadata.
- `demo-seed-datasets`: seed ownership, scope and run-reference corrections.
- `seed-determinism`: fixed-width IDs preserve valid existing bytes across expanded tuples.

## Impact

Owned Prisma writers/validators/operations and colocated tests. Existing contracts are `openspec/specs/demo-seed-datasets/spec.md`, `openspec/specs/record-status-derivation/spec.md` and `openspec/specs/seed-determinism/spec.md`; hypotheses and provenance are the external D37-F09 BRIEF.

## Non-goals

- No new product caps, default-Monday refusal, rollback, provider activation or prompt repair policy.
- No legacy aliases, new assignments, broad row deletion, environment trimming or generic RESP rewrite.
- No native database/socket/browser acceptance inferred from fixtures.
