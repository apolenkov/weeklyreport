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
import { ITEM_STATUS_CHOICES } from "./item-status-choices";
import { ParentPicker } from "./parent-picker";
import { StageStep } from "./stage-step";
import { useInlineEditUnloadGuard } from "./use-inline-edit-unload-guard";
import { useItemEditDialog } from "./use-item-edit-dialog";

const EMPTY_ACTIVITIES: readonly ParentActivityOption[] = [];

function overviewWeekLabel(week: "current" | "next"): string {
  return week === "current" ? "Current week" : "Next week";
}

export function ItemInlineEditor({
  focusNextStep = false,
  saveDisabled = false,
  showNextStep = true,
  showPriority = true,
  confirmationOnly = false,
  onWeekChange,
  ...props
}: Omit<ItemEditDialogProps, "open" | "onDelete"> & {
  readonly focusNextStep?: boolean | undefined;
  readonly draftStore?: ItemEditDraftStore | undefined;
  readonly saveDisabled?: boolean | undefined;
  readonly showNextStep?: boolean | undefined;
  readonly showPriority?: boolean | undefined;
  readonly confirmationOnly?: boolean | undefined;
  readonly onWeekChange?: ((week: "current" | "next") => void) | undefined;
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
  const activeWeekLabel = overviewWeekLabel(props.week);
  return (
    <div ref={dialogSurfaceRef} className="min-w-0">
      <form
        aria-label={`${activeWeekLabel} update for ${form.parentName}`}
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
          {form.parentName} · {activeWeekLabel}
        </p>
        <fieldset
          disabled={confirmationOnly}
          className="min-w-0 space-y-3 border-0 p-0"
        >
          {onWeekChange ? (
            <fieldset>
              <legend className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                Active week
              </legend>
              <div
                role="radiogroup"
                aria-label="Active week"
                className="mt-1 flex gap-2"
              >
                {(["current", "next"] as const).map((week) => (
                  <label
                    key={week}
                    className={`inline-flex min-h-[var(--touch-target-min)] flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--color-ring)] ${props.week === week ? "border-[var(--color-toggle-active)] bg-[var(--color-toggle-active)] text-[var(--color-primary-foreground)]" : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]"}`}
                  >
                    <input
                      type="radio"
                      name="overview-active-week"
                      value={week}
                      checked={props.week === week}
                      onChange={() => onWeekChange(week)}
                      className="sr-only"
                    />
                    {overviewWeekLabel(week)}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <ItemDescriptionField {...form} week={props.week} />
          {showNextStep && props.week === "current" ? (
            <div className="space-y-1">
              <ItemNextStepField
                {...form}
                nextStepTextareaRef={nextStepTextareaRef}
              />
            </div>
          ) : null}
          {!showNextStep && form.nextStepTextError ? (
            <p
              id="item-next-step"
              role="alert"
              tabIndex={-1}
              className="text-xs text-[var(--color-destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              Cancel, then choose More actions → Update status.
            </p>
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
            <ItemStatusFields {...form} choices={ITEM_STATUS_CHOICES} />
          </div>
        </fieldset>
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
        <fieldset disabled={confirmationOnly} className="min-w-0 border-0 p-0">
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
              {showPriority ? <ItemPriorityRankField {...form} /> : null}
            </div>
          </details>
        </fieldset>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {confirmationOnly
            ? "No changes are made until you save."
            : "Unsaved edit · Ctrl/⌘ + Enter to save"}
        </p>
      </form>
    </div>
  );
}
