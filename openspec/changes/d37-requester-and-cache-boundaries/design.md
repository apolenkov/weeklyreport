# Design

## Context

See proposal.md for the three observed failures and existing owners. PDF verification, requester hydration and canonical middleware remain production implementations; focused tests replace only external persistence/revocation ports. Cache tests use the existing Redis port emulator and do not establish native Redis concurrency acceptance.

## Goals / Non-Goals

**Goals:** preserve each existing authorization, identity and freshness boundary with a minimal local change.

**Non-Goals:** create an auth abstraction, change middleware builders, add retries or adopt a distributed cache failure policy.

## Decisions

1. PDF flow before: valid claims → denied requester → unresolved token → dev fallback. After: valid claims → denied requester → terminal null-session context → canonical auth refusal. Returning an explicit context is sufficient; throwing a server error would invent an outcome for logical denial. Invalid tokens still have no context and retain the existing dev/anonymous policy. Technical errors continue to throw.
2. Organization flow before: shared minimum length → whitespace accepted → singleton write. After: shared nonblank refinement → rejection before write. The refinement preserves nonblank input; a trim transform or control-character ban would widen the policy.
3. Cache flow before: increment epoch → scan → delete data and epoch. After: increment epoch → scan → exclude only the exact own generation key → delete data. Moving metadata would change key topology without need; matching data keys still delete.

Canonical procedure identity, report lifecycle tuple and destructive-database guards are unchanged. No database connection or reset is required for these local changes.

## Risks / Trade-offs

- Existing blank persisted brands fail shared repository validation → expose the invalid state explicitly; no unsolicited data migration.
- Faulted epoch increments remain a separate distributed failure gap → retain F540-2 as needs-evidence and require a coordinator native Redis window before selecting a repair.
- Port-based tests do not prove deployed endpoints → coordinator runs the full relevant native boundary and aggregate gates.

## Migration Plan

Deploy ordinary source changes together; no schema migration or feature flag is needed. Reverting these changes reintroduces the recorded failures. The coordinator owns integration, full gates and archival.
