# Design

## Context

Read D37-F16 BRIEF and current owning specs. Root retains main/index/publication and aggregate acceptance. Core fixes are published source checkpoints; native clauses remain needs-evidence.

## Goals / Non-Goals

Repair current owner contracts with genuine owner RED/GREEN. Keep the existing single-flight save queue, immutable authored input, report activation, server CAS, own/foreign boundaries and conflict/refetch/adopt policy. No generic workflow framework or new network authority.

## Decisions

### Persistence and acknowledgement

A receipt records detached immutable canonical items from the actual accepted response. Submission captures receipt scope, original section/generation, a unique local token and detached expected fields. Edit/create acknowledgement requires the corresponding actual persisted identity and fields and a still-current authored row; an earlier save cannot close the composer.

The production discard consumer restores against latest local draft, waits for a committed engine stamp and then invokes a narrow persisted intent on the existing queue. It writes even at the saved comparison baseline, using current CAS version and including unrelated current fields. Accepted means exact scoped server acknowledgement; failed/unknown/conflict retains detached input/dialog with recovery; obsolete/superseded settles once and cannot affect a new activation. No automatic compensation at a newly fetched version.

Actual settlement matrix: immediate/in-flight success/error; queued overwrite; enabled/baseline drain suppression; failure queue cleanup; null reconciliation/rebase; authoritative baseline adoption; activation replacement; disposal. Ordinary forceSave scheduling/equality semantics remain unchanged. Every intentional queue drop settles its exact waiter once. A per-activation restorative-key barrier prevents generic retries of pending/failed compensation while allowing unrelated edits under existing conflict rules.

### Read and UI ownership

Identity-scoped metadata stays in the second argument object of the existing two-element tRPC query key; canonical HTTP input remains reportId only. Public prefix matching still reaches all scopes. Cleanup removes obsolete/unattributed scopes and retains exact trusted current-user/role pending and warm reads. Disabled reads expose no full content.

Role-away gates serverReadOnly, not hook registration. Reseed receives payload/baseline inequality independent of enabled autosave.dirty; delayed own echoes preserve newer local fields and external updates retain existing conflict announcement/adoption.

Section unavailable excludes deterministic missing section from retriable reads while maintaining failed supporting reads and captured pending Retry. Other no-active and normal precedence remain unchanged. Report-keyed Overview content resets local async UI ownership while stable input memory retains report-scoped input. The production adapter receives the actual current section id, tracks every in-flight attempt by section and unique token until finally, and projects pending for that section. A different section can send its existing guarded command while A is pending; same-section/return-to-A and unknown-owner guards stay closed. Late A responses retain existing activation/CAS admission and cannot change B input, baseline, errors or announcements. No public port shape or in-memory protocol changes.

Completion clears raw paused/carry flags through the existing patch. Product traffic fallback is retained only when concrete owned statuses did not change; explicit last-stage clear still yields null. Decision confirmation rechecks current readOnly and closes denied stale confirmation.

## Risks / Trade-offs

- Source fixtures prove client ownership/transport admission, not native committed HTTP/PG outcomes → keep native flags false.
- Existing failed-save discard tests encode unsafe local-only closing → replace their expectation only after a genuine baseline failure, retaining normal no-submission cancel and already-issued write controls.
- Exact scope may reveal missing consumer/test files → ask Root for the concrete path before editing.

## Migration Plan

No migration or dependency update. Root applies the owned patch through ordinary hooks; one aggregate gates/review/native acceptance follows. Revert the exact owned patch for rollback.
