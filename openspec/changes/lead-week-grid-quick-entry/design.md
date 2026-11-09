# Design: contextual quick entry in the Lead Overview

## Intent and decisions

A Lead works within an existing Product or Activity and a three-week report. Keep the established paper visual system and timeline. Place one quiet add action per editable unit in each of Current and Next, including an empty unit. The chosen lane fixes the week and the unit fixes its parent. Input begins inline; the pencil continues to open the canonical detailed editor. Display the Lead’s eligible product stages as directly selectable labels in the item context and let the Lead start a new item directly from a selected stage in its week; apply a sole eligible stage by the existing default, and keep stale selections visible until the user explicitly resolves them. Selecting a stage for a report item does not alter product-stage assignments or grant administrative rights. The separate global toolbar creation flows remain available.

Provide similarly compact inline risk and decision entry in the relevant unit context. Risks and decisions belong to the report section and parent rather than to an invented weekly item lane. One action focuses primary text; details expand on demand. Under `../lead-incomplete-record-drafts/design.md`, draft save requires primary text, valid parent/stages, explicit risk severity and authoritative decision owner; absent impact/mitigation is null. A matching receipt confirms an incomplete draft, not a completed record. Section submission requires complete details or explicit identity-targeted deletion. Product stage choice follows owned eligible stages; Activity has no Product stages. Invalid primary input or context remains visibly unsaved.

A prior commitment is immutable historical input. Its existing Done, Continue, Next week, Paused and Won't do actions write the selected week's occurrence or the existing outcome command, never the prior snapshot. Reuse stable identity, existing rollover precedence, conflict handling and undo; identical text alone is not an identity conflict. Directional buttons and existing keyboard shortcuts provide quick movement without requiring drag.

The comment icon opens a labelled item discussion, including an empty state and a reply composer for the Lead on their own eligible item. The owner explicitly chose two-way conversation. The existing `tracked-work-continuation` contract permits such replies, but current `review.comment` rejects Leads; implement a narrowly scoped Lead write route with server-derived author and transactional ownership, stable lineage and lifecycle checks, while preserving the existing reviewer-only routes and permissions. Existing comments form one chronological discussion; do not invent a threaded relationship or modify frozen historical records.

## Lead discussion authorization and data flow

Use a dedicated `review.leadItemComment` mutation on canonical `leadProcedure` with strict item ID and text input; derive actor identity on the server. Keep all reviewer-only routes and their permissions unchanged. In the coordinated comment transaction, recheck active Lead role and section ownership under the existing User → Report lock order, validate lifecycle eligibility, then re-resolve the item by its section and stable lineage before insert. A foreign, absent or ineligible target must not reveal another author’s report state. This contract applies to an editable own live report; it does not invent a global latest-period lock. Frozen snapshot data is never modified.

The conversation is a flat chronological list with names and timestamps. Preserve comment IDs and creation times when section saves recreate item rows, and order live comments by creation time and ID; otherwise a successfully sent message can duplicate or be resurrected during reconciliation. The UI retains its own per-user/report/section/item draft across rerenders and pending writes. On a confirmed send, merge or refresh comments only for the matching own lineage, never replace the whole unsaved report. On an ambiguous response, preserve text and explain that the Lead should check the conversation before resending; do not automatically retry or claim exactly-once. Reviewer capabilities and the broader existing requirement for comments on other own editable record types remain outside this item-specific increment and must not be claimed complete.

## Minimum-input dependency

TASK-836 adopts durable incomplete drafts, not full-fields-first entry. The related `lead-incomplete-record-drafts` change owns nullable storage, strict submission, scoped publication disclosure and private recovery. Deploy the record composers only with that end-to-end contract; existing complete-only server behavior is not proof of minimum-input support. Until deployed, no local patch or filtered payload may claim a durable incomplete save. Item entry, comments and prior-plan behavior are unchanged.

That dependency also owns the narrow reviewer-write restriction for currently incomplete risk/decision anchors: nonauthor create and delete reject after locked recheck, including reviewer-owned deletion. References above to preserving reviewer permissions mean item, complete-record and section-level permissions; they do not bypass that private-anchor boundary. The item-only Lead reply increment is unchanged. Previously published decisions cannot be made incomplete; full editing must retain valid Impact and show actionable rejection guidance. Private nullable reads and retained discovery require current active authoring entitlement plus exact section authorship even with a cached session. Fill From excludes incomplete source records and points the entitled author to explicit recovery copy, rather than silently copying drafts.

## Alternatives

Putting a modal behind each week button would preserve much of the current code but fails the requested in-grid input. A separate standalone quick-entry store or new write API would duplicate existing draft and concurrency ownership. The selected approach uses the current projection, canonical validated record builders, draft coordinator and save receipts, with small contextual presentation components.

## Boundaries and data flow

1. `report-sections` Overview renders labelled unit/week actions and compact presentation. It passes an explicit existing unit kind/id and Current/Next target; no Previous creation. On mobile, preserve unit and period labels, 44px targets, touch-visible controls and no page overflow.
2. The Lead shell owns one mutually exclusive contextual editor state and all writes. Item creation reuses `useOverviewCreateOpeners`, `saveOverviewItem`, the submission driver, generation and focus/recovery machinery. Detailed edit remains the modal. New inline input participates in existing pending-input, leave and discard guards.
3. Contextual risk/decision presentation produces a valid draft `RiskEntry`/`DecisionEntry` through the canonical nullable draft builders; no changes are made to foreign rows. Empty detail controls normalize to null, never placeholder text. The shell applies a patch against the latest **own** list and waits for a record-specific, generation-scoped persistence receipt before reporting success. A generic last-saved timestamp is not proof that the intended record survived filtering. Keep a stable submitted ID across retries; disable duplicate submissions while pending. Compensating removal of a persisted incomplete create carries explicit kind/stableId deletion intent at the current section version, not mere list omission.
4. At dispatch, the existing autosave owner captures an immutable whole-section payload, section/generation/scope, expected version, record stableId and input snapshot. Each new risk/decision gets one client-generated stableId which survives builder, own-list merge, payload and server remint. Extend the existing receipt with the saved risk/decision records and submitted request metadata needed to correlate exact kind, stableId, parent and normalized fields; a local patch or generic saved timestamp is not proof.

   On an ambiguous transport result, offer retry of **the same immutable request at the same expected version and same identities**. The existing section CAS runs in the transaction before child writes; competing requests with that version cannot both commit. A conflict or other restriction triggers an uncached authorized read and explicit reconciliation, never replay of the stale whole-section payload at a newer version. A matching row alone is not proof of the complete original payload. Keep later local edits, fence callbacks by generation/attempt and show unresolved outcomes honestly while the server is unavailable.

   Cancel before dispatch removes only the unchanged intended lineage from the latest own draft. After possible dispatch, retain cancel intent until the original result is resolved; if it committed and the lineage is still unchanged, apply and confirm a scoped compensating removal against fresh state. A changed lineage or permission/lifecycle restriction is surfaced for resolution. No stale whole-list rollback; other own and foreign rows are not removed. Reuse the existing coordinator, generation and pending-input mechanisms rather than introducing a general state-machine framework.

5. The comment presentation consumes only the existing authorized `item.comments`; it opens a named discussion with an empty state, direct reply input and focus return. The Lead reply uses a narrowly scoped server-authorized write for an own editable item; preserve input on rejection or uncertainty and refresh that item without replacing newer report edits. Do not fetch foreign/private data or grant delete, review, acknowledgement or verdict permissions.

## Frozen presentation interface and ownership

The integration owner creates the following data-only presentation contract in `apps/web/src/features/report-sections/model/contextual-entry-contract.ts` and exports it through `report-sections/index.ts` before other owners implement forms. This keeps report-sections independent of the Lead page shell. `ItemWorkflowStatus` and `RecordCommentView` are canonical types from `@weeklyreport/shared`. `ItemWorkflowStatus` includes `postponed`; invalid week/status combinations are validated by the canonical owner. Target and input are correlated by discriminant; mismatches and stale parent/stage eligibility are rejected by the integration owner.

```ts
type Parent = {
  readonly kind: "product" | "activity";
  readonly id: string;
  readonly name: string;
};
type ItemTarget = {
  readonly kind: "item";
  readonly parent: Parent;
  readonly week: "current" | "next";
};
type RecordTarget = {
  readonly kind: "risk" | "decision";
  readonly parent: Parent;
};
type ItemInput = {
  readonly text: string;
  readonly nextStepText: string;
  readonly stageNames: readonly string[];
  readonly status: ItemWorkflowStatus;
  readonly pausedReason: string;
};
type RiskInput = {
  readonly text: string;
  readonly impact: string | null;
  readonly mitigation: string | null;
  readonly severity: "at-risk" | "blocked";
  readonly stageNames: readonly string[];
};
type DecisionInput = {
  readonly text: string;
  readonly impact: string | null;
  readonly deadline: string;
  readonly stageNames: readonly string[];
};
type CommonView = {
  readonly eligibleStages: readonly string[];
  readonly authorName: string;
  readonly errors: Readonly<Record<string, string>>;
  readonly message: string | null;
  readonly pending: boolean;
  readonly dirty: boolean;
  readonly canSubmit: boolean;
};
type ItemComposerProps = {
  readonly target: ItemTarget;
  readonly value: ItemInput;
  readonly view: CommonView;
  readonly onChange: (value: ItemInput) => void;
  readonly onSubmit: (mode: "save" | "save-and-add-another") => void;
  readonly onCancel: () => void;
};
type RiskComposerProps = {
  readonly target: RecordTarget & { readonly kind: "risk" };
  readonly value: RiskInput;
  readonly view: CommonView;
  readonly onChange: (value: RiskInput) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};
type DecisionComposerProps = {
  readonly target: RecordTarget & { readonly kind: "decision" };
  readonly value: DecisionInput;
  readonly view: CommonView;
  readonly onChange: (value: DecisionInput) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};
```

The gate freezes the contract. Integration work is divided among explicitly assigned, non-overlapping file owners for the record identity data path, prior-plan verdict, autosave receipt/recovery and Overview host/shell integration; each existing file has at most one active writer. The **item presentation owner** creates only `status-overview-inline-item-form.tsx` and its own test. The **record presentation owner** creates only `status-overview-inline-risk-form.tsx`, `status-overview-inline-decision-form.tsx` and their own tests. The **comments presentation owner** creates only a new named comments-view component and its own test; existing row/preview/comments files and their wiring remain with the host integration owner. Presentation owners emit user intent, never mutate draft state or claim persistence. The contract must be committed and reviewed before presentation work; integration of all candidates follows their completion under the host integration owner. Cross-component and browser tests belong to the integration owner. Workers do not alter the active owner-preview worktree, browser, ports or data.

The separate visual, guideline and UX inputs are archived under `/Users/wrk/work/handoffs/task-836/`.

## Verification

Focused tests must first demonstrate failures for contextual week/owner entry, required fields and stage changes, comment empty state, stale/failed persistence, dirty discard and prior-plan identity. Verify exact saved identity on a matching receipt, no duplicates on retry, preservation of other own rows, no foreign leakage, and unchanged prior snapshot. Exercise existing full editor, toolbar, verdict, move, roles and lifecycle. Run the six root gates, strict OpenSpec validation, appropriate guarded database integration and full E2E where the write contract requires it. Inspect the implemented source in a separate browser session at 1280 and 375 with keyboard, focus, empty/error/pending states and screenshots; do not reset or change the owner's current inspection data.
