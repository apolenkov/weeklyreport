# Design

## Context

See [proposal — Why](./proposal.md#why). The owner decisions take precedence over the arena's rejected recommendation to interpret Move as continuation. This is TASK-707 package 6: planning only, not implementation or archival.

The worktree starts at `99d3651f2`. The repository currently has no archive directory; two recent complete archived changes were read from Git history: `7d4ad05af` (authoritative DLQ gauge) and `6447737ea` (PDF polling recovery). Their proposal/design/tasks/delta structure is retained without restoring archived files to the product tree. Extracts and verification receipts live in the [external P6 evidence directory](/Users/wrk/work/handoffs/wr-513/s26/lead-form/p6/).

### Observed owners, not evidence of implementation

- [Stage helper:8–15](../../../apps/web/src/features/report-sections/model/stage-ownership.ts#L8-L15) auto-applies one owned stage only. [Item seed:43–60](../../../apps/web/src/features/report-sections/ui/item-edit-draft-store.ts#L43-L60), [Risk seed:69–73](../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L69-L73), and [Decision model:70–87](../../../apps/web/src/features/period/ui/decision-edit-dialog-model.ts#L70-L87) have no shared draft-scoped last-choice default.
- [Header Add:11–35](../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L11-L35) always seeds Current. [New-item defaults:166–175](../../../apps/web/src/features/report-sections/ui/item-edit-dialog-helpers.ts#L166-L175) already choose Planned for Next; [week switching:93–96](../../../apps/web/src/features/report-pages/ui/lead/shell/use-overview-item-editor.tsx#L93-L96) currently changes only placement.
- [Empty lane:59–79](../../../apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx#L59-L79) already renders the dash and screen-reader copy. [Create host:39–53](../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L39-L53) mounts one composer.
- [Move patch and guard:21–72](../../../apps/web/src/features/report-sections/model/lead-actions/lead-item-actions.ts#L21-L72) move the same occurrence while preserving progress and refusing a colliding placement. [Overview regression:1703–1744](../../../apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.test.tsx#L1703-L1744) expects Next `in_progress`, no write before Save, and cleared carried state. [Existing next-step promotion:287–300](../../../apps/web/src/features/report-pages/ui/lead/shell/overview-item-save.ts#L287-L300) is a different branch and is not redesigned.

## Goals / Non-Goals

**Goals:** make the four owner decisions coherent across the four existing capabilities; preserve complete modified requirement blocks and their unaffected scenarios; leave testable implementation packages 14–16.

**Non-goals:** a new store, API, field, endpoint, persisted preference, status vocabulary, or UI redesign. The editor's existing receipt/discard behavior and page blocking remain unchanged. No browser storage of corporate prose is introduced.

## Decisions

### 14. Reuse the record-stage boundary, not a new validation policy

The [stage delta](./specs/risk-stage-integrity/spec.md) replaces and renames the unconditional empty-on-create rule. All three record types consume the same bounded default policy rather than separate guesses. The default is Product- and lead-section-draft-scoped, visibly selected, correctable, and limited to an eligible owned stage. Existing stored edit selection and an explicit opener prefill win; a sole owned stage remains automatic. A multi-stage Product without an eligible choice starts empty. Parent changes retain the existing reset semantics; they must not carry the old Product's selection into the new one. Multi-select remains available for deliberate choices, but assignment to all stages is never the default.

The [risk delta](./specs/status-risk-unification/spec.md) is necessary: its existing rule allows only clearing or originating-stage prefill and does not describe a draft default. It delegates the default to the stage capability without changing risk-floor semantics.

Rejected: select all assigned stages (owner forbids it); infer a stage from Product health or arbitrary array order (not a last explicit choice); replace stored stages on edit (data loss); add a persisted browser preference (not authorized). Memory mechanics not settled by the owner are bounded below rather than invented.

### 15. Several entry points, one creation flow

The [Overview delta](./specs/lead-status-overview/spec.md) changes all conflicting owners together: canonical creation, compact route/header controls, empty cells, and timeline-width composer hosting. A contextual action carries only reporting-unit identity and Current/Next source into the existing creation opener. It is an additional entry point, not an additional composer or item clone. Empty Current/Next cells remain useful creation targets; Previously planned and ineligible units remain read-only. Keyboard focus reveals the action without hover; touch does not require a reveal gesture. Next starts Planned and stays editable. Existing-item week moves do not receive that create-only default.

Rejected: remove the header action (owner says keep it); mount a composer in each cell (duplicates and receipt risk); automatically reset moved existing progress to Planned (violates placement/progress independence). No status-label unification is included.

### 16. Reconcile Move with code; keep continuation distinct

The [progress delta](./specs/record-status-derivation/spec.md) and Overview preview delta specify the owner's placement-only postponement. In the existing supported case (Current without a next commitment), Save changes `type` to Next, not `workflowStatus` to postponed. It removes that occurrence from Current, preserves identity/progress, clears the carried marker, and does not invent a Current result or continuation text. Cancel follows existing discard rules and performs no move. Existing next-step promotion is outside this reconciliation; the owner decision does not authorize rewriting it. `Continue next week` remains a separate existing verdict/status contract.

Rejected: reinterpret Move as Continue, retain a Current result and write `nextStepText` (contradicts the owner and the named regression); force Planned or Postponed on a moved existing item (contradicts preserved progress).

### Data flow: unchanged request and persistence boundaries

Before:

```text
Header + -> create(Current) -> editor draft
Stage create -> empty / sole-owned-stage helper
Move -> editor(Next) -> Save -> placement patch
Editor draft -> DraftPatch -> autosave/saveSection
             -> existing validation/authorization -> Item/Risk/Decision
```

After implementation (not performed by P6):

```text
Header + / cell +(Current|Next) -> one create opener
Create stage seed -> contextual prefill / eligible draft default
                  / sole stage / empty, as applicable
Next create -> editable Planned; existing moves preserve progress
Same editor -> same DraftPatch -> same saveSection boundary
Move -> same guarded placement patch; Continue remains separate
```

No shared schema, Prisma model, lifecycle writer, or downstream API/read model changes. The server continues to validate stages and `safeText`; defaults are convenience, never authority.

## Invariants: preserved, not relaxed

- [Carry-over precedence and dedupe](../../specs/carry-over-automation/spec.md#L9-L76): explicit eligible Next wins W+1; otherwise unfinished Current continues; no more than one active Next per `stableId` and one target occurrence per lineage. Carry-over stays unconfirmed until explicit Lead action.
- [Previous immutability](../../specs/lead-status-overview/spec.md#L327-L332): no contextual create or move targets the prior occurrence or published snapshot.
- [Period dual-state](../../specs/period-dual-state/spec.md#L18-L33): `periodState` and the complete lifecycle tuple remain atomically written. Record creation/moves do not introduce lifecycle writes.
- Existing canonical role middleware, object-level access, stage ownership/Product–Activity XOR, required pause reason, required risk Impact/Mitigation, and destructive-DB guards are unchanged. No DB operation is part of P6.

Each modified requirement repeats the W+1/Previous/atomicity boundary beside its baseline code anchors for review.

## Risks / Trade-offs

- [Last choice is not yet a complete memory lifecycle contract] → package 14 must resolve the narrow boundaries below with the coordinator before implementing memory; no guessed persistence or multi-selection ordering is specified.
- [Contextual controls can disappear with mobile empty-lane compaction] → package 15 must test empty and populated Current/Next, keyboard focus, and touch at 375 and 1280; the approved compact layout is not redesigned here.
- [Baseline anchors drift during parallel UI packages] → anchors are explicitly tied to `99d3651f2`; implementers rebase after package 1 and preserve owning symbols/tests rather than treating line numbers as current after integration.
- [Strict validation proves syntax, not the UI] → P6 runs spec/format/link checks only; future tasks require TDD, independent review, all repository gates, and coordinator-owned browser acceptance.

## Migration Plan

1. Review and commit this spec-only proposal on `wr707-spec`; do not push, sync durable specs, archive, or check off implementation tasks.
2. After package 1 and coordinator acceptance, resolve package 14's bounded questions, then implement packages 14–16 from [tasks](./tasks.md). Keep P5 mobile and P4 new-item-week behavior integrated without duplicate handlers.
3. No DB migration, feature flag, or deployment order across API/web is required; this proposes web defaults and reconciles already-supported placement semantics. Publish only after implementation acceptance; sync/archive then, not now.
4. Roll back a future web package through its commit if needed; no data transformation is required. Current P6 rollback removes only its planning artifacts.

## Unresolved boundaries for package 14

The owner has decided the default source and its editable nature, not the following mechanics. These are explicitly **not** new product decisions in this proposal:

- Does “last chosen” advance immediately on a stage-picker change, or only after successful Save? A cancelled/failed editor must have a defined effect before implementation.
- With a deliberate multi-stage selection, which one stage is remembered (last toggled, last saved singleton, or another owner-approved rule)? Never infer “all stages.”
- Must the draft-scoped choice survive editor remount, page reload, or reopening the same saved draft? No persistent browser/server preference is authorized by P6.

Package 14 contains a coordinator decision gate for these points. Packages 15–16 and empty-cell reconciliation do not depend on answering them. No unresolved interpretation remains for the three owner decisions themselves: Move is postponement, contextual `+` is allowed, and defaults are editable and never all-stage.
