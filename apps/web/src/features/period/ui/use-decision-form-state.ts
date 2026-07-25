"use client";

import { type Dispatch, type SetStateAction, useState } from "react";

import type { RecordParent } from "../../report-sections";
import type {
  DecisionFieldErrors,
  DecisionFormSeed,
} from "./decision-edit-dialog-helpers";

export interface DecisionFormState {
  readonly text: string;
  readonly setText: Dispatch<SetStateAction<string>>;
  readonly impact: string;
  readonly setImpact: Dispatch<SetStateAction<string>>;
  readonly deadline: string;
  readonly setDeadline: Dispatch<SetStateAction<string>>;
  readonly parent: RecordParent;
  readonly setParent: Dispatch<SetStateAction<RecordParent>>;
  readonly stageIds: string[];
  readonly setStageIds: Dispatch<SetStateAction<string[]>>;
  readonly errors: DecisionFieldErrors;
  readonly setErrors: Dispatch<SetStateAction<DecisionFieldErrors>>;
}

export interface DecisionFormFieldsView {
  readonly text: string;
  readonly onTextChange: (value: string) => void;
  readonly textError: string | undefined;
  readonly deadline: string;
  readonly onDeadlineChange: Dispatch<SetStateAction<string>>;
  readonly impact: string;
  readonly onImpactChange: (value: string) => void;
  readonly impactError: string | undefined;
  readonly parent: RecordParent;
  readonly onParentChange: (next: RecordParent) => void;
  readonly stageIds: string[];
  readonly onStageChange: (next: string[]) => void;
  readonly stageError: string | undefined;
}

// Seeded once from the bound decision (or create-mode defaults); the parent
// unmounts the dialog on close, so no useEffect reset is needed. Owner is not
// state — it is author-only and stays on the seed.
/**
 * Use Decision Form State.
 * @param seed - The seed argument.
 * @param initialParent - The initialParent argument.
 */
export function useDecisionFormState(
  seed: DecisionFormSeed,
  initialParent: () => RecordParent,
): DecisionFormState {
  const [text, setText] = useState(seed.text);
  const [impact, setImpact] = useState(seed.impact);
  const [deadline, setDeadline] = useState(seed.deadline);
  const [parent, setParent] = useState<RecordParent>(initialParent);
  // Create mode begins without a selected stage, while edit mode restores the
  // saved stages. Required-stage validation and single-stage auto-selection
  // live on the save path.
  const [stageIds, setStageIds] = useState<string[]>(seed.stageIds);
  const [errors, setErrors] = useState<DecisionFieldErrors>({});
  return {
    text,
    setText,
    impact,
    setImpact,
    deadline,
    setDeadline,
    parent,
    setParent,
    stageIds,
    setStageIds,
    errors,
    setErrors,
  };
}

/**
 * Decision Fields View.
 * @param state - The state argument.
 */
export function decisionFieldsView(
  state: DecisionFormState,
): DecisionFormFieldsView {
  const clearError = (field: keyof DecisionFieldErrors) =>
    state.setErrors((prev) => ({ ...prev, [field]: undefined }));
  return {
    text: state.text,
    onTextChange: (value) => {
      state.setText(value);
      clearError("text");
    },
    textError: state.errors.text,
    deadline: state.deadline,
    onDeadlineChange: state.setDeadline,
    impact: state.impact,
    onImpactChange: (value) => {
      state.setImpact(value);
      clearError("impact");
    },
    impactError: state.errors.impact,
    parent: state.parent,
    // Switching the parent re-scopes the stage options and clears the prior
    // selection rather than selecting every owned stage. An activity hides the
    // stage step; switching back to a product re-shows it empty.
    onParentChange: (next) => {
      state.setParent(next);
      state.setStageIds([]);
    },
    stageIds: state.stageIds,
    onStageChange: (next) => {
      state.setStageIds(next);
      clearError("stageIds");
    },
    stageError: state.errors.stageIds,
  };
}
