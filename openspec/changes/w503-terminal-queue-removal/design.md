# Design

## Context

See [proposal](proposal.md). Coordinator 002 approved option A in the external
[adapter design](/home/user/work/handoffs/task-503/api-confirmed-fixes/packet1/queue-red/design/ADAPTER.md).
This author worktree is frozen at TASK-513
`76416bce000cf2f791f069bca76c9ffd3438b0fc`; the earlier main60 preparation
worktree and receipts remain read-only.
Its prepared test remains frozen at SHA256
`a3bbbe304d23db828a24af83df95ac2cb60f29898d93823dff3d75a09858c1f5`.
Coordinator obtained genuine native RED2 on this frozen513 tree at 22:48;
readback and immutable raw logs are in the external queue-fix/native-prep
handoff. Both original races failed on behavior, not setup. Approved product
source implementation has begun after that RED. Checks, hooks and GREEN still
require coordinator resource grants. Final rebase and acceptance use actually
published TASK-513 main.

Current contracts and composition paths:

| Consumer                   | Contract / producer                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Head retry/remove          | [ops.procedures.ts](../../../apps/api/src/infrastructure/trpc/routers/admin/ops.procedures.ts), [JobsService](../../../apps/api/src/modules/admin/jobs.service.ts), [AdminJobHandle](../../../apps/api/src/modules/admin/admin-jobs.port.ts)                            |
| Native admin queue handles | [AdminBullmqJobsQueue](../../../apps/api/src/infrastructure/bullmq/admin-jobs-queue.adapter.ts), [createBootstrapJobsService](../../../apps/api/src/bootstrap/jobs-service.ts)                                                                                          |
| Terminal reminder recovery | [reEnqueueStuck](../../../apps/api/src/modules/reminders/reminders-enqueue.ts), [RemindersBullmqEnqueuer](../../../apps/api/src/modules/reminders/reminders-bullmq-enqueuer.adapter.ts), [RemindersModule](../../../apps/api/src/modules/reminders/reminders.module.ts) |
| Normal enqueue             | [JobEnqueuer](../../../apps/api/src/infrastructure/bullmq/job-enqueuer.ts), [PdfExportBullmqEnqueuer](../../../apps/api/src/modules/pdf-export/pdf-export-bullmq-enqueuer.adapter.ts)                                                                                   |
| Primary native proof       | [terminal-removal.integration.test.ts](../../../apps/api/src/modules/reminders/terminal-removal.integration.test.ts)                                                                                                                                                    |

Existing owning scenarios are
[head queue investigation](../../specs/queue-reliability-monitoring/spec.md#requirement-head-queue-investigation-covers-every-monitored-queue),
[failed actions and superseded PDF cleanup](../../specs/queue-reliability-monitoring/spec.md#requirement-failed-job-actions-refresh-the-displayed-list-and-count),
and [retained-terminal reaper recovery](../../specs/reliable-reminder-delivery/spec.md#scenario-a-retained-failed-job-does-not-block-reaper-recovery).
Their fixed-state behavior does not establish state/identity arbitration.
Tracking: C0757 / TASK-503.28 and C1358 / TASK-503.54, found in the existing
`REGISTRY-503.review-delivery-evidence-map.json`; coordinator owns those cards.

## Goals / Non-Goals

**Goals:** Close the destructive queue boundary once for both callers, preserve
the caller-observed instance under same-id reuse, and expose truthful outcomes.
One native integration owner covers the two distinct callers; a scoped
dependency-contract test independently guards the native script coupling.

**Non-Goals:** No custom Redis cleanup engine, global producer capability
expansion, test-only production seam, repeated race proof at each layer, or
atomic transaction between Redis and PostgreSQL. Durable claim/rendering and
PDF generation authorization remain with their existing owners.

## Decisions

### One guarded native removal capability

Introduce one infrastructure/bullmq adapter whose Redis command performs
terminal membership and snapshot-identity comparisons before executing the
dependency's compiled native `removeJob` content in that same command. Obtain
the compiled content and key/argv signature from the post-TASK-513 resolved
BullMQ package. Do not copy expanded native cleanup into owned source or
manually delete queue keys. Preserve native scheduler, lock, child-dependency,
deduplication, parent and event handling, including native failures.

```text
BEFORE
Head Remove / stale cleanup / reminder recovery
  │ real job lookup + getState = failed
  ├───────── public retry commits failed → waiting
  ▼
unconditional native remove → waiting job lost → apparent success

AFTER
caller observes job snapshot identity + allowed terminal states
  │ concurrent retry/replacement can commit
  ▼
ONE Redis command
  [current terminal membership + observed identity match]
          │ match                    │ missing/changed
          ▼                          ▼
  dependency native remove      structured no-removal outcome
          │                          │
          └───────── caller mapping ──┘
  admin: truthful removed flag
  reminder: add only after removed/missing; reject changed state/identity
```

A process mutex does not cover other clients; another state read leaves the
same next await gap. Broad `JobEnqueuer` optional removal would permit
unconditional fallback. These alternatives do not satisfy the approved contract.

### Bind identity to the observed Redis job snapshot

Capture the real terminal handle before its held getState read, binding its
namespace/id, `name`, serialized `data` from `job.asJSON()`, `timestamp` and
`finishedOn`. Compare those captured values against the Redis hash inside the
conditional command. Never reconstruct identity from replacement enqueue input
or re-read a new terminal snapshot after the await gap. Validate captured id,
terminal timestamp and serialized fields before invoking Redis; unknown or
malformed identity fails closed. Attempt count/context remain independent
preservation witnesses in the original native fixture.

`finishedOn` is an observed-terminal snapshot fence, not a claim that retry never
changes it: a legitimate retry leaves the terminal set, so the atomic state
predicate rejects before native removal. Recreated terminal work whose stored
snapshot differs is rejected even under the same UUID. An exactly byte-identical
recreation of all captured fields cannot be distinguished by that snapshot;
this is a diagnostic limit, not proof of a globally unique queue-instance token.

Require the scope's immutable job snapshot to distinguish a recreated terminal
entry, even when the stable domain UUID is unchanged. Verify that property with
the identity-replacement control before accepting the chosen field signature;
do not weaken it silently or accept a same-id recreated hash as preservation.

### Keep destructive authority separate from enqueue

The superseding independent reviewer port-scope advice preserves generic `JobEnqueuer` and
search unchanged. Narrow the reminders add argument to `Pick<JobEnqueuer, "add">`
and require a separate `TerminalJobRemoval` second constructor argument.
`AdminBullmqJobsQueue` instantiates the same concrete owner internally, preserving
its existing `(name, queue)` constructor. Its getJob/getFailed paths capture the
already fetched Job at handle construction; they do not re-fetch a newer job.
Affected handles expose checked removal outcomes, with no optional fallback.
No bootstrap, search or PDF-service edit is needed for this composition.

Caller state policy remains explicit: Admin removal and stale-reminder cleanup
allow failed only; reminder recovery allows failed/completed. Superseded PDF
cleanup remains generation-scoped, best effort after the durable advance, and
must never remove a newer generation, active work or a changed instance.

### Map each outcome without fabricated success

| Atomic outcome                          | Admin removal / stale cleanup                    | Reminder recovery                                |
| --------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| removed                                 | `removed: true` only for this confirmed deletion | normal stable-id enqueue                         |
| missing                                 | no removal; preserve existing no-op semantics    | stable-id enqueue allowed; do not claim deletion |
| state changed / ineligible              | `removed: false`; no destructive retry           | reject before enqueue                            |
| identity changed                        | `removed: false`; do not target replacement      | reject before enqueue                            |
| native lock/scheduler/transport failure | preserve error behavior; no success              | propagate; no successful replacement             |

Add remains a separate native operation. If another job appears after an
eligible removal or missing outcome, BullMQ's existing stable-id deduplication
must preserve it; recovery must not remove that new occupant to force an add.
PostgreSQL existence/revival callbacks remain production callbacks, not fake
fixture admission. Queue removal does not authorize changing durable lifecycle.

### Loud compatibility contract on the actual delivery tree

The version/content/key-count/argv signature is intentionally tied to the
reviewed dependency implementation. A scoped executable contract test must
fail loudly on version or compiled-script change, and the adapter must refuse
an unverified contract before mutation. Native proof must cover the reviewed
signature; no fallback to unconditional `Job.remove`.

BullMQ 6.3.12 is only the historical preparation receipt. Frozen513 declares
6.3.14. The read-only primary package in `wr-deps-20261013` is 6.3.14; its
compiled native module SHA256 is
`0df3ab40e0f72977d57416c97f86f4963e8d3c42a87b77ae495254885657eda3`.
The native Lua content SHA256 is
`f2acb16fda20ccac200abd5289a8910e48870d454c1577b19bd375ab809bb4b6`;
that script declares name `removeJob`, 2 keys and 3 native arguments. The
dependency contract test targets the canonical published CJS export via
createRequire, with unknown export-shape validation. The published CJS module
SHA256 is `2eff81d60dd5df346a4d40f18f3d14affa8bf045237f12c9213f407cc1e9a079`;
its Lua content is identical. No ESM runtime failure is claimed. The contract
test is authored but NOT RUN and is not the atomicity RED. Coordinator already
installed the own frozen tree and generated Prisma for RED; refresh actual
resolution and signature again after final main rebase.

Use typed `queue.getBackend()`, `backend.client`, `queue.toKey` and public
`backend.finishedErrors`. IRedisClient exposes defineCommand/runCommand rather
than eval: register the combined script and execute one native Lua transaction
through those typed methods. The native `removeArgs` builder is protected; no cast,
reflection or private-method access is authorized. Wrap guard locals inside
`do ... end`, then append the exact imported compiled Lua unchanged. Pass native
KEYS `[jobKey, repeatKey]` and native ARGV `[jobId, 1, queuePrefix]`, followed by
the private guard arguments. Preserve native return 1 as confirmed removal,
0 as the native locked-job error and negative codes via `finishedErrors`;
unknown responses fail closed. Emit the existing local Queue `removed` event
only after confirmed native removal.

## Risks / Trade-offs

- Dependency internals can change → fail closed, update the scoped compatibility
  contract deliberately, then rerun native proof on the actual delivery SHA.
- Snapshot identity can be too weak or include retry-mutated fields → verify
  same-id replacement rejection and legal retry preservation before acceptance.
- A setup error can masquerade as RED → require actual failed→waiting witnesses
  and the intended disappearance/replacement assertions, not import/version errors.
- Native cleanup has more effects than deleting a hash → reuse compiled native
  removal intact and check lock/scheduler and positive terminal controls.
- Redis/PostgreSQL operations are not one transaction → keep durable lifecycle
  ownership, generation arbitration and at-most-once send claims unchanged.

## Migration Plan

1. Preserve the original genuine-RED fixture and receipts on the approved
   frozen513 author tree. Implement the approved source after coordinator RED2;
   obtain separate grants for checks/hooks/GREEN. Native v2 changes the original
   race scenarios only by real capability composition; four additional controls
   cover terminal success/missing/local event, changed snapshot, real active lock
   and completed policy. Added controls are not retroactive baseline RED proof.
2. Resolve the actual dependency and prepare the guard-approved D fixture only
   under a current lease. Guarded reset and explicit canonical demo seed precede
   each database-backed phase. No Redis flush or shared prefix mutation.
3. Observe both native RED failures on unfixed source and retain immutable logs.
4. Implement the one adapter and its required contracts/composition as one
   coherent product repair. No database migration or feature flag is needed.
5. Rebase onto actually published TASK-513 main, re-resolve the installed
   dependency, then observe GREEN, positive failed/completed/missing/non-terminal/active-lock and
   same-id replacement controls; run six gates on the reviewed tree and obtain
   independent acceptance before coordinator publication.
6. If compatibility is unverified, keep the destructive capability unavailable;
   rollback must not restore an unconditional destructive fallback. Coordinator
   owns main delivery, remote CI follow-up and closure of both existing cards.

This design does not claim native execution, product repair, runtime GREEN,
review acceptance or an approved new heavy-check window.
