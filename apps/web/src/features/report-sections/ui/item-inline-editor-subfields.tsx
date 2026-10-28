"use client";

import { type RefObject, useState } from "react";

import type { ParentActivityOption } from "../model/record-parent";
import type { ItemEditDialogProps } from "./item-edit-dialog";
import {
  ItemDescriptionField,
  ItemNextStepField,
  ItemPriorityRankField,
  ItemStatusFields,
} from "./item-edit-dialog-fields";
import { choicesForWeek } from "./item-status-choices";
import { ParentPicker } from "./parent-picker";
import { StageStep } from "./stage-step";
import { useItemEditDialog } from "./use-item-edit-dialog";

export type InlineForm = Omit<
  ReturnType<typeof useItemEditDialog>,
  | "dialogSurfaceRef"
  | "handleKeyDown"
  | "handleSave"
  | "handleSaveAndAddAnother"
  | "requestClose"
  | "discardDialog"
>;

export function InlineEditPrimaryFields({
  form,
  week,
  showNextStep,
  nextStepTextareaRef,
}: {
  readonly form: InlineForm;
  readonly week: "current" | "next";
  readonly showNextStep: boolean;
  readonly nextStepTextareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [nextStepRevealed, setNextStepRevealed] = useState(false);
  const hasNextStepError = Boolean(form.nextStepTextError);
  if (hasNextStepError && !nextStepRevealed) setNextStepRevealed(true);
  return (
    <>
      <ItemDescriptionField {...form} week={week} />
      {(showNextStep || hasNextStepError || nextStepRevealed) &&
      week === "current" ? (
        <div className="space-y-1">
          <ItemNextStepField
            {...form}
            nextStepTextareaRef={nextStepTextareaRef}
          />
        </div>
      ) : null}
      {!form.isActivityParent ? (
        <StageStep
          id="item-stage"
          stageNames={form.stageNames}
          availableStages={form.availableStages}
          isDeadEnd={form.isDeadEnd}
          error={form.stageError}
          deadEndNotice={`No stages assigned on ${form.parentName}. Contact your administrator.`}
          onChange={(next) => form.onStageChange([...next])}
        />
      ) : null}
      <div>
        <ItemStatusFields {...form} choices={choicesForWeek(week)} />
      </div>
    </>
  );
}

export function InlineEditDetails({
  form,
  products,
  activities,
  showPriority,
  disabled,
}: {
  readonly form: InlineForm;
  readonly products: ItemEditDialogProps["products"];
  readonly activities: readonly ParentActivityOption[];
  readonly showPriority: boolean;
  readonly disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
      <details>
        <summary className="min-h-[var(--touch-target-min)] cursor-pointer py-3 text-xs font-semibold text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
          Edit details
        </summary>
        <div className="space-y-3 pt-2">
          <ParentPicker
            id="item-product"
            value={form.parent}
            products={products}
            activities={activities}
            onChange={form.onParentChange}
          />
          {showPriority ? <ItemPriorityRankField {...form} /> : null}
        </div>
      </details>
    </fieldset>
  );
}
