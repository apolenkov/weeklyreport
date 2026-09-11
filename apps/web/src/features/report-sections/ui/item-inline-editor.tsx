"use client";

import { useEffect, useRef } from "react";

import type { ParentActivityOption } from "../model/record-parent";
import type { ItemEditDialogProps } from "./item-edit-dialog";
import {
  ItemDescriptionField,
  ItemNextStepField,
  ItemPriorityRankField,
  ItemStatusFields,
} from "./item-edit-dialog-fields";
import type { ItemEditDraftStore } from "./item-edit-draft-store";
import { CURRENT_WEEK_CHOICES, NEXT_WEEK_CHOICES } from "./item-status-choices";
import { ParentPicker } from "./parent-picker";
import { StageStep } from "./stage-step";
import { useInlineEditUnloadGuard } from "./use-inline-edit-unload-guard";
import { useItemEditDialog } from "./use-item-edit-dialog";

const EMPTY_ACTIVITIES: readonly ParentActivityOption[] = [];

export function ItemInlineEditor({
  focusNextStep = false,
  saveDisabled = false,
  ...props
}: Omit<ItemEditDialogProps, "open" | "onDelete"> & {
  readonly focusNextStep?: boolean | undefined;
  readonly draftStore?: ItemEditDraftStore | undefined;
  readonly saveDisabled?: boolean | undefined;
}) {
  useInlineEditUnloadGuard();
  const activities = props.activities ?? EMPTY_ACTIVITIES;
  const nextStepTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusNextStep && props.week === "current") {
      nextStepTextareaRef.current?.focus();
    }
  }, [focusNextStep, props.week]);
  const { dialogSurfaceRef, handleKeyDown, handleSave, ...form } =
    useItemEditDialog({
      ...props,
      activities,
      presentation: "inline",
      onSave: (item) => {
        if (!saveDisabled) props.onSave(item);
      },
    });
  const choices =
    props.week === "current" ? CURRENT_WEEK_CHOICES : NEXT_WEEK_CHOICES;
  return (
    <div ref={dialogSurfaceRef} className="min-w-0">
      <form
        aria-label={`${props.week === "current" ? "Current week" : "Next week"} update for ${form.parentName}`}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            props.onCancel();
          } else handleKeyDown(event);
        }}
        className="min-w-0 space-y-3"
      >
        <p className="break-words text-xs font-semibold text-[var(--color-muted-foreground)]">
          {form.parentName} ·{" "}
          {props.week === "current" ? "Current week" : "Next week"}
        </p>
        <ItemDescriptionField {...form} week={props.week} />
        {props.week === "current" ? (
          <ItemNextStepField
            {...form}
            nextStepTextareaRef={nextStepTextareaRef}
          />
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
          <ItemStatusFields {...form} choices={choices} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={form.isDeadEnd || saveDisabled}
            className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
          >
            Save update
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-3 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            Cancel
          </button>
        </div>
        <details>
          <summary className="min-h-[var(--touch-target-min)] cursor-pointer py-3 text-xs font-semibold text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
            Edit details
          </summary>
          <div className="space-y-3 pt-2">
            <ParentPicker
              id="item-product"
              value={form.parent}
              products={props.products}
              activities={activities}
              onChange={form.onParentChange}
            />
            <ItemPriorityRankField {...form} />
          </div>
        </details>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Unsaved edit · Ctrl/⌘ + Enter to save
        </p>
      </form>
    </div>
  );
}
