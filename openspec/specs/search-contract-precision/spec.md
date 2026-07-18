# search-contract-precision Specification

## Purpose

Requires search's excludeTypes to omit every named type's result chunk, matching the precision the contract promises.

## Requirements

### Requirement: `excludeTypes` Omits Every Named Type's Result Chunk

The search repository's `search()` method MUST omit the result chunk for
EVERY `SearchHit["type"]` value present in the caller's `excludeTypes`
parameter, not a fixed subset of types. A type present in `excludeTypes`
MUST NOT appear in the returned hits, and MUST NOT consume a slot in the
per-type or overall result limit.

#### Scenario: Excluding a non-`project` type omits its hits

- **WHEN** `search()` is called with `excludeTypes` containing `"item"`
  (or `"risk"`, or `"decision"`)
- **THEN** no hit of that type appears in the result
- **AND** hits of the other, non-excluded types still appear, ranked and
  limited as usual

#### Scenario: Excluding `project` still works as before

- **WHEN** `search()` is called with `excludeTypes` containing `"project"`
- **THEN** no project hit appears in the result, matching existing
  lead/viewer behavior
