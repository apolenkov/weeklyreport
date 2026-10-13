# Design

## Context

The application reads a revision before asynchronous preparation or capability
work. Native RED demonstrates stale writes at both completion boundaries. The
global pointer CAS alone cannot prevent these earlier/later lifecycle updates.

## Decisions

Preparation start uses a conditional update against the observed lifecycle,
updatedAt, preparationStartedAt and preparationFinishedAt in one transaction.
The successful start changes the existing preparationStartedAt ownership marker;
it advances by at least one millisecond even when the wall clock is frozen or
moves backwards. Later progress, completion and failure writes match that marker,
preparing lifecycle and an unfinished preparation. A rejected write returns a
controlled conflict and cannot start inference or overwrite the winner. This uses
existing columns; updatedAt is not the only CAS discriminator.

Capability persistence locks the provider revision row inside its transaction,
reads its current lifecycle and preserves active/superseded/preparing. The exact
execution claim CAS remains before evidence persistence in the same transaction;
a superseded attempt still returns without revision writes. Ordinary non-serving
draft/validated/failed revisions continue to follow the capability outcome.

## Risks / Trade-offs

Row locks serialize short database-only operations; provider work remains outside
transactions. A preparation timestamp can advance slightly beyond wall time when
retries share a millisecond; elapsed values already clamp to zero. CAS conflicts
are explicit retries rather than availability defaults. Independent native tests
remain necessary to prove PostgreSQL behavior; unit doubles cannot prove locking.

## Migration Plan

No schema migration. Deploy repository and application together. Coordinator
replays the original native interleavings, runs full gates and independent review.
