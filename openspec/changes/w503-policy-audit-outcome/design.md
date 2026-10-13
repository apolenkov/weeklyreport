# Design

## Context

See [proposal.md](proposal.md). The router currently reads existence outside the transaction. The query then upserts, locks the policy, locks live reports, pauses prior rule versions and reconciles each report. PostgreSQL Read Committed gives each statement a new snapshot; the pre-read cannot identify what the subsequent transaction actually wrote. Coordinator 002 approved this bounded design for TASK-503.19.

```text
Before: admin.savePolicy -> exists read -> policy/rules transaction -> audit(pre-read)
After:  admin.savePolicy -> policy/rules transaction -> {policy, created}
                                                     -> audit(created) -> policy DTO
```

## Goals / Non-Goals

**Goals:** Keep transaction atomicity, canonical admin middleware, policy -> reports -> rules lock order, the existing reconciliation clock and the public policy DTO. Make create/update an outcome of persistence.

**Non-Goals:** No isolation-level change, schema migration, dependency update, queue repair or PostgreSQL 18-only result metadata.

## Decisions

1. Within the existing transaction, use `createMany` with `skipDuplicates`; its affected-row count identifies an actual insert. Then use the existing policy lock. An inserted row needs no second update. An existing locked row is updated with the submitted fields before reconciliation. This works on PostgreSQL 15 and 18; `xmax` inspection or PostgreSQL 18 `RETURNING OLD` would constrain portability.
2. When insertion reports a conflict but the subsequent lock finds no row, repeat insertion plus locking, at most three attempts. Read Committed permits a conflicting row to disappear between these statements. Never fall back to a blind upsert with a stale creation flag. Exhaustion throws a dedicated domain conflict; all other database failures propagate.
3. Return an internal `{ policy, created }` result through the admin repository and validated service. The router audits `created` and returns only `policy`. Remove the now-unused existence query, service method and test-only fixtures.
4. The primary regression calls the public admin procedure with a real Prisma repository and captures its audit events. Existing paused-Prisma support delays one request before its transaction while another request completes. This independently reproduces two old `create` events; transaction fakes do not establish the PostgreSQL claim. Additional real-statement interception pauses after an actual skipped insert to exercise delete-before-lock. It delegates database statements unchanged and adds no production seam.

## Risks / Trade-offs

- Competing deletion can prevent progress -> finite retries and typed conflict, with no success audit.
- Existing focused transaction mocks cannot prove PostgreSQL isolation or rollback -> keep their scope explicit; native tests prove persistence and audit together.
- Internal return type reaches fixtures -> update only owned consumers and preserve F's period-envelope/CAS signatures during coordinator integration.
- Integration tests manipulate synthetic records -> execute only after the coordinator grants D's lane, guarded reset and explicit seed.

## Migration Plan

No data migration or client rollout is required. Ship the query, repository, service and router as one change after real RED/GREEN, six repository gates and independent review. Reverting the complete change restores the former behavior without a schema rollback.
