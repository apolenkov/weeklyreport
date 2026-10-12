"use client";

import { type RefObject, useEffect, useId, useRef } from "react";

import {
  computeEffectiveStageNames,
  ownedStagesForProject,
  ParentPicker,
  StageStep,
} from "../../../../report-sections";
import {
  nextPlanHint,
  type OverviewPlanFields,
  type OverviewPlanState,
  type PlanOutcome,
} from "./overview-plan-command";

const MAX_OUTCOME_TEXT = 500;
export const BUTTON =
  "min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50";
const FIELD =
  "w-full min-h-24 resize-y rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
export const CHOICES = [
  { value: "done", label: "Done" },
  { value: "continue", label: "Continue" },
  { value: "plan_next", label: "Plan next" },
  { value: "wont_do", label: "Won't do" },
] as const;
export const ACTIVE_ITEM_CHOICES = CHOICES.filter(
  ({ value }) => value === "done" || value === "wont_do",
);

export interface ComposerProps {
  readonly state: OverviewPlanState;
  readonly pending: boolean;
  readonly blockedReason: string | null;
  readonly recoveryReason: string | null;
  readonly error: string | null;
  readonly onChoose: (outcome: PlanOutcome) => void;
  readonly onChange: (patch: Partial<OverviewPlanFields>) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

function OutcomeDetails({
  state,
  onChange,
}: Pick<ComposerProps, "state" | "onChange">) {
  const id = useId();
  const { fields, editorAtOpen } = state;
  const stages =
    fields.parent.kind === "product"
      ? ownedStagesForProject(editorAtOpen.draft.section, fields.parent.id)
      : [];
  return (
    <details open={fields.parent.kind === "unresolved"}>
      <summary
        className={`${BUTTON} cursor-pointer py-3 text-[var(--color-primary)]`}
      >
        Parent and stages
      </summary>
      <div className="space-y-3 pt-2">
        <ParentPicker
          id={`${id}-parent`}
          value={fields.parent}
          products={editorAtOpen.view.viewModel.products}
          activities={editorAtOpen.view.viewModel.activityOptions}
          onChange={(parent) =>
            onChange({
              parent,
              stageNames:
                parent.kind === "product"
                  ? computeEffectiveStageNames(
                      [],
                      ownedStagesForProject(
                        editorAtOpen.draft.section,
                        parent.id,
                      ),
                    )
                  : [],
            })
          }
        />
        {fields.parent.kind === "product" ? (
          <StageStep
            id={`${id}-stages`}
            stageNames={fields.stageNames}
            availableStages={stages}
            isDeadEnd={stages.length === 0}
            error={undefined}
            deadEndNotice="No stages are assigned here. Choose another parent or contact your administrator."
            onChange={(stageNames) => onChange({ stageNames })}
          />
        ) : null}
      </div>
    </details>
  );
}

function OutcomeFields({
  state,
  onChange,
}: Pick<ComposerProps, "state" | "onChange">) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const { fields } = state;
  useEffect(() => {
    input.current?.focus();
  }, [fields.outcome]);
  if (fields.outcome === null) return null;
  const field =
    fields.outcome === "wont_do"
      ? "reason"
      : fields.outcome === "plan_next"
        ? "planText"
        : "resultText";
  const label =
    fields.outcome === "wont_do"
      ? "Why won't this be done?"
      : fields.outcome === "plan_next"
        ? "Next-period commitment"
        : "This period's update";
  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`${id}-text`}
          className="mb-1 block text-sm font-semibold"
        >
          {label}
        </label>
        <textarea
          ref={input}
          id={`${id}-text`}
          className={FIELD}
          value={fields[field]}
          maxLength={MAX_OUTCOME_TEXT}
          onChange={(event) => onChange({ [field]: event.target.value })}
        />
      </div>
      {fields.outcome === "continue" ? (
        <div>
          <label
            htmlFor={`${id}-next`}
            className="mb-1 block text-sm font-semibold"
          >
            Next step (optional)
          </label>
          <textarea
            id={`${id}-next`}
            className={FIELD}
            value={fields.nextStepText}
            maxLength={MAX_OUTCOME_TEXT}
            onChange={(event) => onChange({ nextStepText: event.target.value })}
          />
        </div>
      ) : null}
      {fields.outcome === "plan_next" ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {nextPlanHint(state)}
        </p>
      ) : null}
      {fields.outcome === "wont_do" ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          The reason and author are recorded. You can restore this plan while
          the section is editable.
        </p>
      ) : null}
      <OutcomeDetails state={state} onChange={onChange} />
    </div>
  );
}

export function OutcomeChoices({
  state,
  choices,
  firstChoice,
  onChoose,
  onChange,
}: Pick<ComposerProps, "state" | "onChoose" | "onChange"> & {
  readonly choices: readonly (typeof CHOICES)[number][];
  readonly firstChoice: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <>
      <div
        role="group"
        aria-label="Plan outcome"
        className="flex flex-wrap gap-2"
      >
        {choices.map((choice, index) => (
          <button
            key={choice.value}
            ref={index === 0 ? firstChoice : undefined}
            type="button"
            aria-pressed={state.fields.outcome === choice.value}
            className={`${BUTTON} border border-[var(--color-border-strong)] aria-pressed:bg-[var(--color-surface-hover)]`}
            onClick={() => onChoose(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <OutcomeFields state={state} onChange={onChange} />
    </>
  );
}
