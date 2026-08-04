## Context

The audit found 13 P0 failures across four trust boundaries: period lifecycle truth, concurrent writes, identity-scoped UI state, and executable security/operations evidence. The current system has good local helpers, but callers can still accept optional lifecycle fields, coerce impossible states, validate before a later unguarded write, or rely on tests that never execute.

Load-bearing invariants remain unchanged: period dual-state is strict and atomic; role middleware builders remain the only authorization entry; production destructive operations require explicit consent; deferred features remain loud. This design tightens those invariants and does not relax compatibility silently.

### Before

```text
wire/DB row -> optional/coercing read -> pre-check -> id-only write
                                      \-> stale state can win

selected report -> previous-render ref -> quick-add modal -> new report draft

security/ops claim -> todo/fixme/name-only confirmation -> green or runnable path
```

### After

```text
legacy input -> explicit versioned normalizer -> strict lifecycle tuple
current input/DB -> strict tuple parser ------> guarded command transaction
                                             expected tuple + write -> exactly 1 row

selected report generation -> keyed editor state -> same-generation draft only

security/ops claim -> executable adversarial probe/full target consent -> gate
```

## Goals / Non-Goals

**Goals:**

- Resolve all 13 P0 findings with direct positive and negative evidence.
- Make missing, contradictory, stale, or unresolved lifecycle state fail closed.
- Make validation and mutation one atomic ownership boundary.
- Prevent report-scoped UI state from crossing report identity.
- Make SAML, PDF, lifecycle-gate, and restore claims executable and non-skippable.

**Non-Goals:**

- P1-P3 repairs or the ten repo-wide style/test epics.
- New lifecycle states, role permissions, or product features.
- General backward compatibility in current schemas; only named legacy snapshot/import boundaries may normalize old payloads.

## Decisions

### 1. Separate strict current lifecycle schemas from legacy decoding

Create one shared strict lifecycle object that requires `periodState`, legacy `status`/`archived`, `periodStatus`, audit flags, and applicable timestamps, then cross-validates allowed tuples. Current API/read-model schemas compose it without `.optional()` or defaults. A separately named, versioned legacy snapshot decoder accepts old shapes and must return a strict parsed object or a typed incompatibility error.

Alternative rejected: retaining optional fields with consumer fallbacks. It continues to certify incomplete current state and makes every consumer a migration engine.

### 2. Use one fail-closed lifecycle vocabulary at every read seam

Define exact predicates/parsers for live editable (`draft`, not archived, `scheduled|open`) and section editable (`periodStatus=open|reopened` plus a consistent tuple). Period factory, active-workspace resolution, admin creation, and section writes consume these results; no function maps an unknown state to `open`.

Alternative rejected: scattered boolean filters. They caused the archived-draft and null-status failures and cannot prove tuple consistency.

### 3. Validation and mutation belong to one guarded transaction command

Period unarchive and section writes use compare-and-set predicates containing the full expected lifecycle/version tuple; affected-row count must equal one. Project-activity group moves and lead attachments run their membership check and write in a serializable transaction with a bounded retry for serialization conflicts. Typed stale/integrity errors map at the existing tRPC error boundary.

Alternative rejected: service read followed by repository id-only update. No isolation level can repair a predicate that is absent from the write.

### 4. Make governed Report writes allow-only and conservative

All writes to lifecycle-governed fields flow through the transition module and its branded transition result. The type-aware gate resolves Prisma delegate aliases and data values through the TypeScript checker. An unresolved computed/spread/helper value in a governed write is a failure, not an exemption. Exemptions are structured, referenced, and limited to the transition module; planted probes cover direct, aliased, computed, variable, helper, conditional, and spread forms.

Alternative rejected: adding more regex/AST surface patterns. Equivalent syntax would remain an open-ended bypass class.

### 5. Key editor state by a report generation, not a render-time ref

`LeadForm` derives a stable generation key from report and section identity and passes the current loaded context directly into the editor hook. Opening a quick action captures that key; navigation closes/resets transient dialogs. A save whose captured key differs from the active key is rejected locally and never mutates the new draft.

Alternative rejected: synchronizing the existing ref in an effect. Effects still leave a render/event window and preserve two sources of truth.

### 6. Security and worker evidence must execute in canonical gates

The SAML harness mints a valid signed response using the checked-in test-only certificates and runs valid signature, mutated signature, wrong certificate, and replay cases. The PDF E2E removes its stale `fixme`, waits on the job/artifact contract rather than `networkidle`, and asserts persisted artifact metadata. A central test-marker gate rejects `todo`, `skip`, `fixme`, and focused tests in security/PDF/lifecycle critical paths.

Alternative rejected: metadata-only unit tests or advisory markers. Neither exercises the trust boundary.

### 7. Restore consent binds to the exact resolved target

The restore script requires explicit host, port, database, and environment identity, renders one canonical target string, and requires an exact confirmation token derived from that string. Production additionally requires the existing production-destructive consent mechanism. Archive readability is checked before consent and mutation; `pg_restore` remains single-transaction.

Alternative rejected: database-name-only confirmation. Database names are routinely reused across clusters.

### 8. Resolution is driven by an evidence manifest

Add a machine-readable manifest mapping each P0 id to changed owners, governing specs, positive tests, planted negative probes, and canonical gate commands. A verifier rejects missing ids, duplicate ownership, skipped tests, absent probes, or findings marked resolved without passing evidence. This is the first ratchet for the later P1/style campaigns.

## Risks / Trade-offs

- [Legacy snapshots stop parsing through current schemas] -> Route only explicit legacy versions through the normalizer and add fixture coverage for every supported version.
- [CAS/serializable conflicts become visible] -> Map to typed retryable conflicts, bound automatic transaction retries, and preserve idempotency.
- [Type-aware lifecycle analysis increases lint cost] -> Cache the TypeScript program, scope analysis to governed write candidates, and benchmark it inside the canonical lint gate.
- [SAML fixtures accidentally resemble production secrets] -> Keep explicit `customreport-test-*` certificate subjects and add a secret/fingerprint guard preventing production material.
- [PDF E2E is service-dependent] -> Gate it only in the existing integration lane with deterministic Redis/worker/database composition; do not replace it with a unit approximation.
- [One change spans several modules] -> Implement in invariant-owned slices with an evidence checkpoint after each P0 cluster; do not merge partially green lifecycle behavior.

## Migration Plan

1. Add strict lifecycle types/parsers, legacy decoder, and negative fixtures without changing writers.
2. Convert readers and selection paths to strict fail-closed results.
3. Convert period/section/project-activity mutations to guarded transaction commands.
4. Strengthen the lifecycle gate and plant bypass probes before removing old assumptions.
5. Key lead-form editor state by generation and add navigation/modal tests.
6. Activate SAML and PDF integration cases and marker enforcement.
7. Harden restore consent and shell tests.
8. Run scoped tests after each cluster, then strict OpenSpec, typecheck, lint with zero warnings, unit/integration/E2E gates, build, and the P0 evidence verifier.

Rollback is code-only for the strict reader/writer rollout during MVP; no production database reset or destructive rollback is permitted. If a supported legacy payload fails, add a versioned normalizer case rather than weakening the current schema.

## Open Questions

- Should serialization conflicts be retried in repositories or one application-level transaction runner? The tasks phase must select one owner before implementation.
- Which canonical integration command will own SAML replay persistence so the negative case proves more than in-memory duplicate detection?

## Resolved Questions

- Legacy period snapshot support is limited to explicit version `1`: the
  pre-lifecycle shape containing the date envelope, legacy `status`, and an
  optional `archived` flag. Current snapshots use the strict current schema.
  Unversioned input and mixed v1/current lifecycle fields are rejected rather
  than inferred.
