import type {
  ItemWorkflowStatus,
  RecordCommentView,
} from "@weeklyreport/shared";

export interface Parent {
  readonly kind: "product" | "activity";
  readonly id: string;
  readonly name: string;
}

export interface ItemTarget {
  readonly kind: "item";
  readonly parent: Parent;
  readonly week: "current" | "next";
}

interface RecordTarget {
  readonly kind: "risk" | "decision";
  readonly parent: Parent;
}

export interface ItemInput {
  readonly text: string;
  readonly nextStepText: string;
  readonly stageNames: readonly string[];
  readonly status: ItemWorkflowStatus;
  readonly pausedReason: string;
}

export interface RiskInput {
  readonly text: string;
  readonly impact: string | null;
  readonly mitigation: string | null;
  readonly severity: "at-risk" | "blocked";
  readonly stageNames: readonly string[];
}

export interface DecisionInput {
  readonly text: string;
  readonly impact: string | null;
  readonly deadline: string;
  readonly stageNames: readonly string[];
}

interface CommonView {
  readonly cancelLabel?: string;
  readonly eligibleStages: readonly string[];
  readonly authorName: string;
  readonly errors: Readonly<Record<string, string>>;
  readonly message: string | null;
  readonly pending: boolean;
  readonly dirty: boolean;
  readonly canSubmit: boolean;
}

export interface ItemComposerProps {
  readonly target: ItemTarget;
  readonly value: ItemInput;
  readonly view: CommonView;
  readonly onChange: (value: ItemInput) => void;
  readonly onSubmit: (mode: "save" | "save-and-add-another") => void;
  readonly onCancel: () => void;
}

export interface RiskComposerProps {
  readonly target: RecordTarget & { readonly kind: "risk" };
  readonly value: RiskInput;
  readonly view: CommonView;
  readonly onChange: (value: RiskInput) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

export interface DecisionComposerProps {
  readonly target: RecordTarget & { readonly kind: "decision" };
  readonly value: DecisionInput;
  readonly view: CommonView;
  readonly onChange: (value: DecisionInput) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

export interface CommentsViewProps {
  readonly id: string;
  readonly itemLabel: string;
  readonly comments: readonly RecordCommentView[];
  readonly onClose: () => void;
}
