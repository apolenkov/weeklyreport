# Design

## Context

See proposal.md. `review.assembledReport` currently passes only the resolved report id to the same full assembly used by publication.

## Goals / Non-Goals

Require the caller's session on preview reads and derive sections and portfolio from one scoped graph. Keep internal assembly and publication writes full.

## Decisions

Before: authenticated head → resolved report id → full graph → full preview.

After: authenticated head → resolved report id + session → canonical section scope in Prisma include → existing assembled mapper → scoped sections and portfolio.

The named `getAssembledPreview` method requires a session at the service and repository boundary. The repository rejects a missing session before querying. The existing `getAssembledReport` remains the internal full read used by auto-publication. A distinct required method avoids an optional session silently widening caller access.

The mapper computes portfolio totals from scoped sections, folding shared products once and retaining existing risk floors. Filtering only the final section array would leak full portfolio totals and is rejected.

## Risks / Trade-offs

Accidentally routing internal publication through preview → keep `publishAuto`, transaction snapshot reread, and full include unchanged; verify full publication in the native coordinator check.

Incorrect SQL relation filtering → verify actual PostgreSQL Head A, groupless head and Admin outcomes rather than infer isolation from a query mock.

## Migration Plan

No schema, flags, dependencies or lifecycle changes. Existing web callers retain the same RPC name and output schema. Canonical `headProcedure`, period dual-state invariants and destructive guard remain in force. Coordinator owns native checks, all six repository gates, independent review and delivery.
