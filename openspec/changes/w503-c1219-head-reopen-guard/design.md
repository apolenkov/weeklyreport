# Design

## Context

See proposal.md. The existing service checks role, latest target, absence of reopened periods, Settings and window before the repository transaction. Per-report CAS already binds the full lifecycle and reporting boundaries. Admin recovery explicitly permits multiple reopened reports.

## Goals / Non-Goals

**Goals:** make the Head absence predicate effective at the serialized write boundary without altering lifecycle/CAS/children or Admin recovery.

**Non-Goals:** linearize latest target, Settings, or window changes; change the newest reopened resolver; add a global uniqueness constraint.

## Decisions

Before: server prechecks → reminder policy row locks → per-report CAS → children.

After: server prechecks + mandatory role-derived policy → shared status-graph transaction barrier → sorted reminder policy row locks → Head-only absence predicate → existing per-report CAS → existing children.

Reuse `lockStatusGraph(tx)` first: restore already acquires the same barrier before policies/report locks. An empty ReminderPolicy table cannot serialize writers, so its locks alone are insufficient. Admin takes the same barrier and skips only the Head predicate. A global unique index would break legal Admin recovery and is rejected. The policy argument is required and has no optional bypass default; the service derives it from `session.role !== "admin"`.

Period dual-state, full lifecycle/envelope CAS, atomic section/request/reminder writes, canonical role middleware and destructive guards remain intact. No UI, request payload, schema, migration, dependency or configuration changes are needed. Direct repository test callers must state their intended policy explicitly.

## Risks / Trade-offs

- Shared barrier contention → reuse the established serialization lane and lock order instead of creating a second lock protocol.
- Latest-published, Settings and time-window can still change after early checks → leave these C1177 residuals OPEN; bounded repair is not whole-finding closure.
- Unit doubles cannot prove SQL serialization → native public Head/Admin interleave and publish/newer-Head concurrency scenarios are prepared for the coordinator's guarded database lane.
- Newest reopened selection with legal Admin multiple rows stays unchanged by controlling design GO; no ambiguity rejection is introduced.

## Migration Plan

Deploy code and explicit callers together after coordinator checks and independent review. No database migration or destructive rollout is required. Rollback restores the prior repository signature and callers together. Native checks, six repository gates and delivery remain coordinator owned.
