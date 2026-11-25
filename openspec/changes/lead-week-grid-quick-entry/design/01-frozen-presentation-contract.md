# Design part 1: frozen presentation interface and ownership

Part of [design.md](../design.md).

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

The separate visual, guideline and UX inputs are archived under `~/work/handoffs/task-836/`.

The nullable contract uses the existing `prepareContextualRisk` and
`prepareContextualDecision` builders. At that boundary, null details become
blank form-control values; canonical payload serialization writes them as null.
Primary text, current parent/stage eligibility, explicit severity and decision
author remain required, and supplied nonblank details keep their text validation.
Contract tests carry both Product and Activity drafts through the existing
own-list merge and shared write schema, preserving caller identity and proving
that incomplete details still block section submission.
