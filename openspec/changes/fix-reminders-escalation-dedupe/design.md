## Context

The hourly reminder tick (`RemindersScheduler.runOnce`) handles two kinds in one
pass: T-24h `deadline` reminders to late leads and T+2h `escalation` digests to
heads. The escalation path is broken at the recipient-resolution step, and the
shared execution-recording path (`requestReminderExecution`) has a
dedupe-then-enqueue race. This change touches only the API reminders module; no
schema, web, or shared-contract change is required.

Current flow (escalation):

```
findDueEscalationRules(now)
  → report.publishedBy            // null while leads are still draft
  → if (!head) continue           // → digest silently dropped
dispatchEscalation(rule)
  → requestReminderExecution(rule.id, rule.head.email, escalation payload)
```

Current flow (dedupe + enqueue, both kinds):

```
requestReminderExecution()
  → findExecutionByDedupeKey(key)  // read
  → if existing → return
  → saveExecution(new row)         // upsert by dedupeKey
  → emailQueue.add('send', ...)    // unconditional, after the upsert
```

Two overlapping ticks both read no row, both upsert (the unique index collapses
the row), but BOTH reach `emailQueue.add` → two emails for one execution.

Target flow:

```
findDueEscalationRules(now)
  → resolve head via late lead's ReportingGroup.headUserId (role head/admin)
  → one digest per (group head) aggregating that group's late leads
  → no publish-state dependency

requestReminderExecution()
  → insert-on-conflict(dedupeKey)  // one atomic op; tells us "inserted?"
  → if not inserted → return existing, enqueue nothing
  → after the row commits → emailQueue.add('send', ...)   // once
```

## Goals / Non-Goals

**Goals:**

- Escalation digests fire for unpublished periods (the normal escalation state),
  routed to the head of each late lead's reporting group.
- Exactly one execution row and at most one email per `(rule, kind, cycle,
recipient)` even under concurrent ticks.
- The `send` job is enqueued only after the row commits and only by the inserting
  caller.

**Non-Goals:**

- Group-scope authorization of dispatch/list/execute (tracked in
  `scope-reminder-authz`).
- Changing the dedupeKey shape or adding a new unique index — the existing
  `ReminderExecution.dedupeKey @unique` is reused as the conflict target.
- Merging the deadline and escalation code paths, or touching the deadline
  recipient resolution (it already resolves correct section authors).
- Reworking the BullMQ worker (`email-reminder.processor.ts`) — the job payload
  shape is unchanged.

## Decisions

### 1. Resolve the escalation head by group, not by publisher

Resolve the recipient from the late lead's `ReportingGroup.headUserId` (the
`ReportingGroup.head` relation, role `head`/`admin` by the model's
application-level invariant), independent of `Report.publishedBy`. The head
must additionally be active (`User.isActive = true`); a deactivated head is
treated like an unresolved head per the repo's soft-deactivation model — no
guard prevents a group from pointing at a head who is later deactivated, so the
filter belongs in recipient resolution.

A `Report` (period) spans the whole department; its late leads can belong to
different reporting groups, each with its own head. So `findDueEscalationRules`
must fan out to one digest per `(group head, rule)` aggregating that group's late
leads, replacing the single `head` field on `DueEscalationRule` with a
per-group-head grouping.

- Alternative — keep `publishedBy` but fall back to a group head when null:
  rejected. Publish happens after escalation, so `publishedBy` is essentially
  always null at escalation time; the fallback would be the only live path. Drop
  the publisher path entirely.
- Alternative — broadcast to all heads/admins: rejected. It mis-targets heads
  who do not own the late group and contradicts the per-group digest contract.

### 2. Atomic insert-on-conflict for dedupe

Replace `findExecutionByDedupeKey` + `saveExecution` in the dispatch path with a
single repository method that inserts the execution and, on conflict with the
`dedupeKey` unique index, does NOT create a second row — and reports whether this
call inserted (`{ execution, inserted: boolean }`).

Prisma's `create` throwing `P2002` on the unique `dedupeKey`, caught and
translated to `inserted: false` (re-reading the existing row), is the simplest
in-Prisma form of insert-on-conflict and matches the existing P2002-handling
pattern already used in `PolicyApplicatorService.applyToPeriod`. A raw
`INSERT ... ON CONFLICT DO NOTHING RETURNING` is an equivalent option if a single
round-trip is preferred.

- Alternative — keep the upsert but gate enqueue on a returned "created" flag:
  Prisma `upsert` does not report whether it created vs updated, so the create-vs-
  hit signal is unavailable without a second query — which reintroduces the race.

### 3. Enqueue after commit, gated on insert

Move `emailQueue.add` so it runs only when `inserted === true`, after the insert
has committed. The job carries `executionId`; a worker reading that row must
never see an uncommitted/rolled-back row. Since each `requestReminderExecution`
records exactly one execution, "after the insert commits" is satisfied by
enqueuing after the awaited insert resolves (no surrounding transaction wraps the
enqueue with the insert).

## Risks / Trade-offs

- [P2002-as-control-flow]: using a caught unique violation to detect a duplicate
  is a normal-path branch, not an error. → Catch narrowly on `code === 'P2002'`
  and the `dedupeKey` target; rethrow anything else, mirroring the existing
  applicator pattern.
- [Per-group fan-out changes the row shape]: `DueEscalationRule.head` becomes a
  per-group grouping; the scheduler's `dispatchEscalation` must iterate group
  heads. → Covered by the spec scenario "each group head receives only their
  group's late leads"; unit-test the multi-group case.
- [Unassigned or deactivated group head]: a late lead in a head-less group, or
  one whose head has `isActive = false`, produces no digest. → Spec requires
  logging the unresolved-active-head case and continuing other groups; do not
  throw.
- [Insert-then-enqueue lost-email hole]: gating the enqueue on `inserted` trades
  the duplicate-email race for a small lost-email window — if the process dies
  between the committed insert and `emailQueue.add`, the row exists, so every
  later tick dedupes (`inserted = false`) and never enqueues, and the email is
  never sent. The current unconditional-enqueue code does not have this hole. →
  Accepted for now over a full transactional-outbox: escalation is a best-effort
  nudge, the crash window is narrow, and an outbox is disproportionate at MVP.
  Revisit with an outbox if reminder delivery becomes delivery-critical.

## Migration Plan

No schema change and no migration: the `ReminderExecution.dedupeKey @unique`
index already exists (`prisma/schema.prisma` model `ReminderExecution`) and is
the conflict target. Deploy is a code-only change to the reminders module.
Rollback is reverting the module changes; no data backfill is involved.

## Open Questions

- None blocking. If a future requirement needs the head also notified for a group
  that has no `headUserId`, that escalation-target fallback is out of scope here
  and would be a separate change.
