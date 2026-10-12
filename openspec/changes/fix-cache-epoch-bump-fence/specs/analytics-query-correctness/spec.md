## ADDED Requirements

### Requirement: A failed invalidation epoch bump does not let an in-flight computation cache its result

When an analytics cache invalidation runs and its generation increment fails, a
computation in the same API process that started before that invalidation MUST
NOT write its result to the cache. Its caller still receives the computed
value. The invalidation MUST still remove matching cache entries, MUST log and
count the failed increment, and MUST complete without failing its publish or
reopen caller. This guarantee covers computations in the API process that
performed the invalidation. The deployment runs a single API replica, and a
multi-process deployment MUST add a cross-process fence before scaling out.

#### Scenario: Epoch bump failure does not resurrect a pre-invalidation value

- **GIVEN** an analytics computation that started before a publish committed
- **AND** a cached entry that matches the invalidated prefix
- **WHEN** the cache invalidation runs in the same API process and its generation increment fails
- **THEN** the invalidation removes the matching entry, logs and counts the failure, and completes
- **AND** the computation returns its value to its caller without writing it to the cache
- **AND** the next read recomputes and may cache the post-publish value
