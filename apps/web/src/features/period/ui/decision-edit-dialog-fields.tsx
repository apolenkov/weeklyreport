"use client";

import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import type { RefObject } from "react";

import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";
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
  readonly textRef: RefObject<HTMLTextAreaElement | null>;
  readonly deadline: string;
  readonly onDeadlineChange: (value: string) => void;
  readonly impact: string;
  readonly onImpactChange: (value: string) => void;
  readonly impactError: string | undefined;
  readonly impactRef: RefObject<HTMLTextAreaElement | null>;
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
      placeholder="e.g. Approve hiring of 2 SDETs in Q3…"
      minHeightPx={60}
      focusOnMount
      textareaRef={textRef}
      characterLimit={SAFE_TEXT_MAX_LENGTH}
      fill={false}
      hint={
        <p className="mb-1 text-xs text-[var(--color-muted-foreground)]">
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
  // ISO dates compare lexicographically; en-CA formats the local day as such.
  const isPast =
    deadline !== "" && deadline < new Date().toLocaleDateString("en-CA");
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
        name="deadline"
        autoComplete="off"
        type="date"
        className="w-full max-md:min-h-[var(--touch-target-min)] rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 py-2.5 text-base md:text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)] focus:outline-none"
        value={deadline}
        aria-describedby={isPast ? "dec-deadline-warning" : undefined}
        onChange={(e) => onDeadlineChange(e.target.value)}
      />
      {isPast ? (
        <p
          id="dec-deadline-warning"
          role="status"
          className="mt-1 text-xs text-[var(--color-muted-foreground)]"
        >
          Deadline is in the past.
        </p>
      ) : null}
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
        characterLimit={SAFE_TEXT_MAX_LENGTH}
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
          deadEndNotice={
            headerProductName
              ? `No stages assigned on ${headerProductName} — contact admin.`
              : "No stages assigned — contact admin."
          }
          onChange={(next) => onStageChange([...next])}
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
