## ADDED Requirements

### Requirement: Feedback memory repository isolates stored values

The current ProductFeedbackMemoryRepository seed/create, duplicate-create, list/focused-list and update boundaries MUST return detached values and MUST isolate stored nested input context from caller mutation. Author scope, idempotent stable ID, paging and explicit update behavior MUST remain unchanged.

#### Scenario: Current captured context is mutated after create

- **WHEN** a test seeds feedback with the current captured diagnostics/screenshot context and then mutates its input or returned values
- **THEN** a subsequent authorized list retains the stored context until an explicit update

#### Scenario: Outward read and update values are mutated

- **WHEN** a caller mutates a list, focused-list, duplicate-create or update result
- **THEN** the next authorized read is unchanged by that mutation
- **AND** unauthorized author/group/delete operations remain refused

### Requirement: Fake Redis preserves the exercised real Store read and reload boundaries

The existing createFakeRedisCall subset used by the real RedisStore MUST expose an expired read as an absent key and MUST reject an unknown EVALSHA with NOSCRIPT so the Store can reload its existing known script. It MUST NOT infer broader command/DECR/window policies.

#### Scenario: Real Store reads an expired window

- **WHEN** a real initialized RedisStore increments a key and reads it after its configured window expires
- **THEN** the Store observes zero hits and the next increment starts a fresh window

#### Scenario: Store sees a restarted empty script cache

- **WHEN** a real initialized RedisStore sends its cached SHA to a fresh fake transport after a simulated Redis restart
- **THEN** it reloads the known script through the normal NOSCRIPT retry path and records the first hit
