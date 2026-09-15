## Context

See proposal.md and the parent P06/P07 decision record. Latest user answers supersede the earlier whole-record-move interpretation: Current remains visible and Next shows a linked continuation. Reverse promotion retains the old result in history. The old moveToNextWeekPatch changes type and clears nextStepText, so it cannot implement this Overview action.

## Goals / Non-Goals

Keep one stable tracked-work lineage, canonical draft saving and immutable published history. Preserve all requested pointer/keyboard interactions, comments and readable history. Do not substitute disabled interactions for missing functionality or introduce an event framework.

## Decisions

Before: move menu → item-patch → type flip and cleared commitment → canonical save.

After: pointer/keyboard/menu → one continuation command → Current text plus nextStepText → canonical draft/save → Current result and linked Next projection. Promotion also persists the superseded result in readable lineage history atomically with replacing active text and consuming the commitment.

- With no continuation, open a focused continuation text form. Save creates the linked Next projection; Cancel changes nothing. With existing continuation, show it without cloning a second item. Creating another distinct continuation requires explicit text selection, retaining displaced content in history.
- Promoting linked Next to Current replaces the active current text with continuation text, records the previous result, and consumes the Next commitment atomically. Standalone Next moves its own text through the same command rules without creating lineage. The selected report section remains the owner; dragging is not report-period creation.
- Completed records cannot create a continuation or promote through these commands; enforce the existing availability rule in both UI and command validation. Promotion sets type=current, workflowStatus=in_progress, pausedReason=null and carriedOver=false. Preserve the prior text and lifecycle tuple in history, including any prior pause reason; do not leave an incompatible paused/completed tuple on active work.
- Same-lineage conflicts show both texts and require explicit selection; no automatic merge or overwrite. History keeps the nonselected text. Failed saves retain recoverable local intent and use existing version-conflict handling.
- Ordering reuses the existing collection order and adds no reorder write. The parent binding row (MOVE-ORDER: "Reuse collection order; preserve text/status and linked source identity") is authoritative: continuation and promotion must not reorder, re-sort or re-index anything, and a projected continuation still resolves to its source record with the same stable identity in every lane. Surviving refetch therefore means the order is unchanged, not that a new position was persisted. A user-visible drag-to-reorder is a separate product request: it needs its own order field and migration, and this change deliberately persists nothing for it.
- Comments belong to stable lineage. Leads may comment on their own editable records through server-derived identity and existing comment-save coordination; retain existing review-author permissions independently. History displays committed actor/time/transition and previous text. Cancelled/failed operations create no committed history entry.

## Allowed implementation scope

Start with report-sections/model/lead-actions/lead-item-actions.ts and tests, lead/chrome/lead-form-draft-actions.ts, canonical draft patch/merge, status-overview model/row/preview controls, shared record schemas, report-section save lineage and item-outcome history modules, and review comment anchor/composer consumers. Inspect callers before changes. Bind exact dependency paths and hashes in the parent packet before dispatch. Serialize with refine-overview-editing-layout; shared tests/specs are not permission to overwrite another owner's work.

## Risks / Trade-offs

- Projection IDs differ from row PKs → resolve by stable lineage; verify after delete/recreate save and refetch.
- Existing history may cover outcomes but not text promotion → extend the smallest existing lineage storage transactionally; a missing readable history path is an implementation gap, not optional scope.
- Two column projections share order → keep source order coherent and test both columns after save; no duplicate persistence row solely for ordering.
- Drag availability can bypass UI controls → enforce owning editable-section rules at the canonical write boundary as well as in the UI.

## Migration Plan

First implement shared contracts and the canonical continuation transition, then any required history persistence/read path, then UI interactions. Reuse existing storage; any demonstrated schema gap follows the single-init-migration policy and exact disposable-target guard with separate per-operation authority. Do not run destructive actions from this plan. Published snapshots are read-only throughout; period dual-state and role-coverage builders remain unchanged. Rollback must preserve persisted history and comments rather than deleting them. No new dependency is required until installed interaction primitives have been assessed.
