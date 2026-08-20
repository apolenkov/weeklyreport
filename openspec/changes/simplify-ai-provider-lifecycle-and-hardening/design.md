## Context

The branch introduced one asynchronous queue and one result envelope for two
different jobs: provider capability tests and prompt-to-provider feature
compatibility evaluations. The latter is no longer a product requirement, but
its types, Prisma relations, prompt evaluator, UI fields, and runtime seams
still make the provider lifecycle appear to depend on prompt evaluation. The
same branch also added protocol negotiation fields even though the runtime has
one code-owned answer contract.

The implementation must preserve the role-coverage gate, encrypted credential
boundary, endpoint allowlist/redirect policy, report authorization boundary,
and the report period dual-state invariant. It changes neither report data nor
the existing AI authorization surface.

## Goals / Non-Goals

**Goals:**

- Keep provider tests focused on the provider's planner, structured answer, and
  embedding contracts, with one fixed runtime protocol.
- Remove prompt compatibility evaluation from provider activation and prompt
  administration, including its durable data and dead adapters.
- Make Chat availability fail closed and make lifecycle writes recoverable and
  race-safe.
- Keep each persistence implementation in infrastructure and split the most
  central orchestration units while preserving public tRPC contracts.

**Non-Goals:**

- Do not introduce a new provider fallback, prompt evaluator, feature flag, or
  per-feature provider configuration.
- Do not change report retrieval, authorization, citations, or the supported
  provider profile allowlist.
- Do not rewrite historical archived OpenSpec changes; only current durable
  specs and active code are updated.

## Decisions

1. **One provider-test flow.** Retain the durable asynchronous provider test,
   but remove its prompt-evaluation branch and rename its queue/job contract to
   provider testing. The result stores capability lanes only; `answerProtocol`
   and `featureCompatibility` are not persisted or returned.

2. **One answer protocol.** The OpenAI-compatible answer adapter always sends
   the existing JSON-object request and parses the shared answer schema. The
   transport no longer accepts arbitrary `responseFormat` values, so a stale
   caller cannot silently negotiate a different protocol. Planner repair keeps
   its bounded same-tool retry.

3. **Atomic lifecycle transitions.** Prompt and provider pointer operations
   treat a failed compare-and-set as a conflict and throw inside the database
   transaction. That rolls back the candidate/superseded lifecycle writes.
   Execution claims move only `queued → running`; queue handoff failures are
   recoverable by re-enqueuing the existing queued execution.

4. **Fail-closed client availability.** The lead Chat component calls the
   generated `trpc.ai.availability` procedure directly. Loading, error, and
   missing data all leave the trigger disabled; test fixtures provide the same
   typed procedure instead of changing production behavior.

5. **Runtime credential cache bound.** Keep provider client reuse, but bound
   the cache by a small fixed size and evict the least-recently-used entry,
   including superseded revisions. This limits process-lifetime retention of
   decrypted credential-bearing transports without changing request behavior.

## Risks / Trade-offs

- [Risk] Existing disposable databases may contain removed compatibility rows
  or columns. → This project is pre-production; update the canonical schema
  and init migration together and regenerate Prisma. No production migration
  is required.
- [Risk] A worker can crash after claiming a job. → Claim only queued rows and
  let BullMQ retry; a later explicit reconciliation can requeue stale queued
  rows without duplicating a running claim.
- [Risk] Removing the UI fallback exposes incomplete fixtures. → Update all
  component fixtures to register the real availability query and keep tests
  for loading/error disabled states.
