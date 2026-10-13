# Design

## Context

See proposal.md for the real PostgreSQL RED. The current router reads before-state separately from the repository update. Organization is a seeded singleton. Audit actor/IP belong to the router.

## Goals / Non-Goals

The repository returns validated previous/next identities from a single write operation. No new wire fields, product testing seam, version column or singleton fallback.

## Decisions

Before: router read → concurrent B commit → repository A update → stale audit.
After: router → repository transaction → SELECT singleton FOR UPDATE → update singleton → commit → router audit captured pair → Organization DTO.

Use a parameterized row lock selecting the full existing Organization schema shape inside the interactive transaction. PostgreSQL serializes concurrent updates of this same row; the read observes the preceding committed identity. Parse previous before updating and next before committing. Return the pair through the existing repository/service method and keep router cache invalidation after success. Separate read/update permits the reproduced race; timestamp/version conflict policy is outside this repair.

Canonical admin middleware, singleton fail-closed behavior, report lifecycle invariants and destructive guards remain preserved. No schema migration, dependencies, web changes or feature flag are required.

## Risks / Trade-offs

- Concurrent organization saves wait on the singleton row lock → keep transaction limited to read/update, audit outside it.
- Unit doubles cannot prove PostgreSQL lock behavior → coordinator replays native real-PG scenario using existing pauseBeforeTransaction helper and preserves original RED.

## Migration Plan

Deploy repository, service and router together; no data migration. Coordinator owns integration, all repository gates and independent review before delivery.
