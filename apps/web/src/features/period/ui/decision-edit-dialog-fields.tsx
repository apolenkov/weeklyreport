"use client";

import type { Ref } from "react";

import { RecordTextareaField } from "../../../shared/ui/record-textarea-field";
import type {
  ParentActivityOption,
  Product,
  RecordParent,
} from "../../report-sections";
import { ParentPicker, StageStep } from "../../report-sections";

interface DecisionEditDialogFieldsProps {
  readonly text: string;
  readonly onTextChange: (value: string) => void;
  readonly textError: string | undefined;
  readonly textRef: Ref<HTMLTextAreaElement>;
  readonly deadline: string;
  readonly onDeadlineChange: (value: string) => void;
  readonly impact: string;
  readonly onImpactChange: (value: string) => void;
  readonly impactError: string | undefined;
  readonly impactRef: Ref<HTMLTextAreaElement>;
  readonly parent: RecordParent;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly onParentChange: (next: RecordParent) => void;
  readonly isActivityParent: boolean;
  readonly stageNames: string[];
  readonly availableStages: readonly string[];
  readonly isDeadEnd: boolean;
  readonly stageError: string | undefined;
  readonly headerProductName: string;
  readonly onStageChange: (next: string[]) => void;
}

type DecisionProseColumnProps = Pick<
  DecisionEditDialogFieldsProps,
  | "text"
  | "onTextChange"
  | "textError"
  | "textRef"
  | "deadline"
  | "onDeadlineChange"
  | "impact"
  | "onImpactChange"
  | "impactError"
  | "impactRef"
>;

type DecisionClassificationColumnProps = Pick<
  DecisionEditDialogFieldsProps,
  | "parent"
  | "products"
  | "activities"
  | "onParentChange"
  | "isActivityParent"
  | "stageNames"
  | "availableStages"
  | "isDeadEnd"
  | "stageError"
  | "headerProductName"
  | "onStageChange"
>;

function DecisionTextField({
  text,
  onTextChange,
  textError,
  textRef,
}: Pick<
  DecisionProseColumnProps,
  "text" | "onTextChange" | "textError" | "textRef"
>) {
  return (
    <RecordTextareaField
      id="dec-text"
      label="Decision"
      required
      value={text}
      onChange={onTextChange}
      error={textError}
      placeholder="e.g. Approve hiring of 2 SDETs in Q3"
      minHeightPx={60}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- forwarded to RecordTextareaField, which owns the actual DOM autofocus and its own justification
      autoFocus
      textareaRef={textRef}
      fill={false}
      hint={
        <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
          The choice you need leadership to make — phrase it as a yes/no or
          short statement, not a discussion topic.
        </p>
      }
    />
  );
}

function DecisionDeadlineField({
  deadline,
  onDeadlineChange,
}: Pick<DecisionProseColumnProps, "deadline" | "onDeadlineChange">) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor="dec-deadline"
      >
        Deadline
      </label>
      <input
        id="dec-deadline"
        type="date"
        className="w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
        value={deadline}
        onChange={(e) => onDeadlineChange(e.target.value)}
      />
    </div>
  );
}

function DecisionProseColumn({
  text,
  onTextChange,
  textError,
  textRef,
  deadline,
  onDeadlineChange,
  impact,
  onImpactChange,
  impactError,
  impactRef,
}: DecisionProseColumnProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <DecisionTextField
        text={text}
        onTextChange={onTextChange}
        textError={textError}
        textRef={textRef}
      />

      <DecisionDeadlineField
        deadline={deadline}
        onDeadlineChange={onDeadlineChange}
      />

      <RecordTextareaField
        id="dec-impact"
        label="Impact"
        required
        value={impact}
        onChange={onImpactChange}
        error={impactError}
        placeholder="What changes when this is decided?"
        minHeightPx={50}
        textareaRef={impactRef}
      />
    </div>
  );
}

function DecisionClassificationColumn({
  parent,
  products,
  activities,
  onParentChange,
  isActivityParent,
  stageNames,
  availableStages,
  isDeadEnd,
  stageError,
  headerProductName,
  onStageChange,
}: DecisionClassificationColumnProps) {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
        Classification
      </span>

      <ParentPicker
        id="dec-product"
        value={parent}
        products={products}
        activities={activities}
        onChange={onParentChange}
      />

      {/* Stage step is product-only — activities own no SDLC stage. */}
      {!isActivityParent && (
        <StageStep
          id="dec-stage"
          stageNames={stageNames}
          availableStages={availableStages}
          isDeadEnd={isDeadEnd}
          error={stageError}
          deadEndNotice={`No stages assigned on ${headerProductName} — contact admin.`}
          onChange={onStageChange}
        />
      )}
    </div>
  );
}

export function DecisionEditDialogFields(props: DecisionEditDialogFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
      <DecisionProseColumn {...props} />
      <DecisionClassificationColumn {...props} />
    </div>
  );
}
