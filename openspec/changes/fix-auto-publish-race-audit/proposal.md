## Why

`PublicationService.publishAuto` (`apps/api/src/modules/publication/application/publication.service.ts:159`)
has an idempotent fast-path: when the fetched report is already
`status === "published"`, it returns `{ published: true, report }` without
calling `saveAutoPublishedReport` — no write happens.

`AutoPublisherScheduler.runOnce` (`apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.ts:92-120`)
only branches on `outcome.published`. Both the "already published, no write"
outcome and the "auto-published just now" outcome carry `published: true`, so
the scheduler cannot tell them apart. On a race — a head manually publishes
the same report between the scheduler's candidate selection and its call to
`publishAuto` — the scheduler still logs `auto-publish period=...` and calls
`this.auditLogger.periodAutoPublish(...)`, recording an auto-publish audit
event for a publish that was actually performed manually by a human and never
auto-published at all. This is a false audit record: the audit trail is
supposed to be the ground truth for "what happened and who did it."

## What Changes

- Extend `AutoPublishResult` (or add a discriminant field) so the
  already-published idempotent branch is distinguishable from the
  wrote-a-new-publish branch, instead of both collapsing to
  `{ published: true }`.
- Update `PublicationService.publishAuto`'s idempotent short-circuit
  (line 159) to return the new "no write occurred" signal.
- Update `AutoPublisherScheduler.runOnce` to check the new signal and skip
  its audit log (`auditLogger.periodAutoPublish`), its `logger.log` line, and
  the missing-sections count query on that branch — mirroring how it already
  suppresses those side effects on the `published: false` (archived) branch.
- Do not touch the `published: false` (archived-after-selection) branch or
  the real auto-publish write path — both already behave correctly.

## Capabilities

### Modified Capabilities

- `publish-compare-and-set` — `publishAuto`'s outcome type must let callers
  distinguish "already published, no write" from "published just now by this
  call", so the scheduler stops auditing races as auto-publishes.

## Impact

- `apps/api/src/modules/publication/application/publication.service.ts` —
  `AutoPublishResult` type and the idempotent branch of `publishAuto`.
- `apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.ts` —
  `runOnce`'s branching on the outcome.
- `apps/api/src/modules/publication/application/publication.service.test.ts`
  — new/updated unit coverage for the discriminated outcome.
- `apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.test.ts`
  — new/updated coverage asserting no audit/log/count on the no-write branch.
- `openspec/specs/publish-compare-and-set/spec.md` — new requirement.

## Non-goals

- Not changing the compare-and-set predicate, the write path, or the
  archived-after-selection (`published: false`) branch — those are correct.
- Not changing manual publish (`period.publish`) or its audit call.
- Not adding a new audit event type for the "raced, no-op" case — the fix is
  to suppress the false auto-publish audit, not to add a new one recording
  the race itself.
- Not changing the candidate-selection query or scheduler cron cadence.
