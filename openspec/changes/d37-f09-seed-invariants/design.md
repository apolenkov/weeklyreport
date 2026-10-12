# Design

## Context

Current seed restore uses ordinary Prisma update semantics: omitted fields remain stored. `upsertItem` omits pause metadata, and assignment upsert can overwrite the owner inserted after an absent read. Existing contracts require non-paused reasons to clear and composed fixture ownership to remain valid. The deterministic-ID requirement already covers ten or more products.

## Goals / Non-goals

Correct admitted existing seed invariants while preserving IDs, actors, stage offsets, source data, capability bounds and guards. No new caps, alias layout, extra assignments, broad cleanup, default-Monday completion refusal, provider policy or composite transaction policy.

## Decisions

Item restore: omitted pausedReason -> existing stored reason survives -> illegal non-paused tuple. After: one data object with omitted reason represented by null for both update/create. Supplied valid reason remains; explicitly invalid tuple remains rejected by real schema/SQL. Identity fields stay supplied by the owning writer.

First owner: absent read -> committed foreign insertion -> update.userId overwrites. After: same natural-key upsert uses empty update, and effective ownership is read back. Create, preexisting owner, IDs and planned count remain unchanged. Ordinary delegate fixture applies actual fields; it does not implement preservation.

IDs use padded physical fields with high digits in previously-zero prefix positions and old low marker/suffix positions retained. One mapping per category, no legacy branch or aliases. Capacity bounds are8-bit lead,12-bit item/product sequence and assignment product,4-bit assignment offset; workflow callers still use their existing offsets0..2. Direct output tests use independent UUID shape and fixed old-byte literals.

Other admitted roots are added only after a current public producer RED. Full native seed acceptance remains independent of the fixture boundary.

## Risks / Trade-offs

Offline persistence delegates demonstrate issued update semantics, not PostgreSQL checks, concurrency, FK cascades, Redis, browser or profile acceptance. Source checkpoints remain nonterminal. Default wall-clock completion policy and unknown socket teardown require separate owning diagnosis.

## Verification

One scoped file per mutex invocation. Preserve genuine RED and setup failures. Source and tests receive strict ESLint, changed formatting, exact diff checks and strict OpenSpec validation. Root performs ordinary hooks, aggregate six and final review/native lanes.

## Implemented CLI boundaries

The guarded Prisma bootstrap/migration commands preserve native spawn error and signal with operation context and cause. Hard-reset SQL qualifies the public identities returned by its existing discovery query; no predicate, schema scope, retry or rollback policy changes. Offline producer tests block dotenv loading and sockets, and stop before Redis.

Validation, canonical and Simple entrypoints protect client construction after pool allocation, collect primary presence separately from its value, and independently attempt both teardown operations. Ordered AggregateError retains primary first and cause only when cleanup also fails. Validation/canonical success output follows cleanup; Simple's real count and period diagnostics stay before disconnect.

Profile scope checks every required id before counts. The runner samples the existing validated date once after the guard and forwards its normalized instant to all children. Default week rollover refusal is deliberately outside this correction.

The disposable database creator uses the same primary-presence and ordered cleanup failure contract, with connect inside the protected client lifecycle. Its existing database-presence fast path still closes the client and never issues CREATE when the target is already present. Actual PostgreSQL races and socket lifecycle are separately unproved.
