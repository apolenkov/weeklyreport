# Design

## Context

`AiPromptRepository.getControl` reads `AiFeaturePromptControl` with its included active revision, then separately reads descending revision history capped by `AI_PROMPT_HISTORY_LIMIT`. `AiPromptService.readEntry` converts both results into active/latest/history bundles without another read. A legal activation can supersede the first revision between these reads, so the same identifier carries contradictory lifecycle state in one administrative response. The runtime's existing snapshot requirement does not cover this admin path.

## Decisions

Use the existing callback transaction pattern from `AiRuntimeConfigurationRepository.resolveReportAssistant`, with `Prisma.TransactionIsolationLevel.RepeatableRead`. Both queries, including the active revision relation, use the transaction client. Preserve null controls, descending order, history limit and public shapes.

```text
Before: admin read -> control + included active [old committed state]
                    -> concurrent activation commits
                    -> history + latest [new committed state]
                    -> mixed admin payload
After:  admin read -> repeatable-read transaction
                    -> control + included active [snapshot]
                    -> concurrent activation commits independently
                    -> history + latest [same snapshot]
                    -> coherent admin payload
```

The regression uses two real stored revisions: active baseline and validated candidate. A delegating test Proxy pauses after the actual control query completes, lets the ordinary repository activate and commit the candidate, then releases history reading. It wraps both root and callback transaction clients and binds unrelated client methods to their original receiver. Query results are never invented. Events prove control read, committed writer and history read ordering; two-second waits and finally-release prevent an unreleased barrier.

The public service payload must retain the old active bundle, the same active lifecycle/payload for that identifier in the two-row history, and the candidate's pre-activation validated lifecycle. Separately verify the database now points to the candidate and has superseded the baseline. A no-pause newer-draft control proves active and latest may differ; a missing-control case preserves null behavior.

## Risks / Trade-offs

- The response may legitimately describe the state before the concurrent activation. Coherence does not promise the newest committed state at response delivery.
- The history remains bounded; the regression's two rows do not impose general active membership.
- Proxy instrumentation is test-local and delegates real Prisma operations. Native RED/GREEN must confirm both event points are reached.
- Short read transactions consume a connection for both queries. No locking, retry or serialization contract is added.

## Migration Plan

No migration, flag or dependency change. The report lifecycle tuple, canonical role middleware, activation CAS and destructive guard remain unchanged. PostgreSQL operations stay under the coordinator's native lease with guarded reset and explicit seed. Do not patch production until the coordinator supplies actual native RED. Coordinator owns six final gates, independent review, normal hooks and delivery; rollback restores the two independent reads.
