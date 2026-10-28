"use client";

import { useEffect, useRef } from "react";

import type { ParentActivityOption } from "../model/record-parent";
import type { ItemEditDialogProps } from "./item-edit-dialog";
import type { ItemEditDraftStore } from "./item-edit-draft-store";
import {
  InlineEditDetails,
  InlineEditPrimaryFields,
} from "./item-inline-editor-subfields";
import { useFocusCancelWhenLocked } from "./use-focus-cancel-when-locked";
import { useItemEditDialog } from "./use-item-edit-dialog";

const EMPTY_ACTIVITIES: readonly ParentActivityOption[] = [];

function overviewWeekLabel(week: "current" | "next"): string {
  return week === "current" ? "Current week" : "Next week";
}

function ActiveWeekFieldset({
  week: activeWeek,
  onWeekChange,
  disabled,
}: {
  readonly week: "current" | "next";
  readonly onWeekChange: ((week: "current" | "next") => void) | undefined;
  readonly disabled: boolean;
}) {
  if (!onWeekChange) return null;
  return (
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
            className={`inline-flex min-h-[var(--touch-target-min)] flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--color-ring)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${activeWeek === week ? "border-[var(--color-toggle-active)] bg-[var(--color-toggle-active)] text-[var(--color-primary-foreground)]" : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]"}`}
          >
            <input
              type="radio"
              name="overview-active-week"
              value={week}
              checked={activeWeek === week}
              disabled={disabled}
              onChange={() => onWeekChange(week)}
              className="sr-only"
            />
            {overviewWeekLabel(week)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InlineEditActions({
  saveBlocked,
  onCancel,
  onSaveAndAddAnother,
}: {
  readonly saveBlocked: boolean;
  readonly onCancel: () => void;
  readonly onSaveAndAddAnother?: (() => void) | undefined;
}) {
  const cancelRef = useFocusCancelWhenLocked(saveBlocked);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={saveBlocked}
        className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
      >
        Save update
      </button>
      {onSaveAndAddAnother ? (
        <button
          type="button"
          onClick={onSaveAndAddAnother}
          disabled={saveBlocked}
          className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-transparent px-3 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
        >
          Save and add another
        </button>
      ) : null}
      <button
        ref={cancelRef}
        type="button"
        onClick={onCancel}
        className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-3 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        Cancel
      </button>
    </div>
  );
}

type ItemInlineEditorProps = Omit<ItemEditDialogProps, "open" | "onDelete"> & {
  readonly focusNextStep?: boolean | undefined;
  readonly draftStore?: ItemEditDraftStore | undefined;
  readonly saveDisabled?: boolean | undefined;
  readonly showNextStep?: boolean | undefined;
  readonly showPriority?: boolean | undefined;
  readonly confirmationOnly?: boolean | undefined;
  readonly onWeekChange?: ((week: "current" | "next") => void) | undefined;
  readonly weekChangeDisabled?: boolean | undefined;
};

function InlineEditHint({
  confirmationOnly,
  hasAddAnother,
}: {
  readonly confirmationOnly: boolean;
  readonly hasAddAnother: boolean;
}) {
  return (
    <p
      className={`text-xs text-[var(--color-muted-foreground)] ${confirmationOnly ? "" : "hidden [@media(hover:hover)_and_(pointer:fine)]:block"}`}
    >
      {confirmationOnly
        ? "No changes are made until you save."
        : hasAddAnother
          ? "Ctrl/⌘ + Enter to save · Ctrl/⌘ + Shift + Enter to save and add another"
          : "Ctrl/⌘ + Enter to save"}
    </p>
  );
}

function useFocusNextStep(focusNextStep: boolean, week: "current" | "next") {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusNextStep && week === "current") ref.current?.focus();
  }, [focusNextStep, week]);
  return ref;
}

type DialogForm = Omit<
  ReturnType<typeof useItemEditDialog>,
  "dialogSurfaceRef" | "discardDialog"
>;

interface InlineFormViewProps {
  readonly form: DialogForm;
  readonly week: "current" | "next";
  readonly products: ItemEditDialogProps["products"];
  readonly activities: readonly ParentActivityOption[];
  readonly showNextStep: boolean;
  readonly showPriority: boolean;
  readonly confirmationOnly: boolean;
  readonly saveDisabled: boolean;
  readonly onWeekChange?: ((week: "current" | "next") => void) | undefined;
  readonly weekChangeDisabled?: boolean | undefined;
  readonly nextStepTextareaRef: ReturnType<typeof useFocusNextStep>;
}

function InlineFormView({
  form,
  week,
  products,
  activities,
  showNextStep,
  showPriority,
  confirmationOnly,
  saveDisabled,
  onWeekChange,
  weekChangeDisabled,
  nextStepTextareaRef,
}: InlineFormViewProps) {
  return (
    <form
      aria-label={`${overviewWeekLabel(week)} update for ${form.parentName}`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSave();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          form.requestClose();
        } else form.handleKeyDown(event);
      }}
      className="min-w-0 space-y-3"
    >
      <p className="break-words text-xs font-semibold text-[var(--color-muted-foreground)]">
        {form.parentName} · {overviewWeekLabel(week)}
      </p>
      <fieldset
        disabled={confirmationOnly}
        className="min-w-0 space-y-3 border-0 p-0"
      >
        <ActiveWeekFieldset
          week={week}
          onWeekChange={onWeekChange}
          disabled={weekChangeDisabled ?? false}
        />
        <InlineEditPrimaryFields
          form={form}
          week={week}
          showNextStep={showNextStep}
          nextStepTextareaRef={nextStepTextareaRef}
        />
      </fieldset>
      <InlineEditDetails
        form={form}
        products={products}
        activities={activities}
        showPriority={showPriority}
        disabled={confirmationOnly}
      />
      <InlineEditActions
        saveBlocked={form.isDeadEnd || saveDisabled}
        onCancel={form.requestClose}
        onSaveAndAddAnother={form.handleSaveAndAddAnother}
      />
      <InlineEditHint
        confirmationOnly={confirmationOnly}
        hasAddAnother={form.handleSaveAndAddAnother !== undefined}
      />
    </form>
  );
}

export function ItemInlineEditor({
  focusNextStep = false,
  saveDisabled = false,
  showNextStep = true,
  showPriority = true,
  confirmationOnly = false,
  onWeekChange,
  ...props
}: ItemInlineEditorProps) {
  const nextStepTextareaRef = useFocusNextStep(focusNextStep, props.week);
  const activities = props.activities ?? EMPTY_ACTIVITIES;
  const { dialogSurfaceRef, discardDialog, ...dialogForm } = useItemEditDialog({
    ...props,
    activities,
    presentation: "inline",
    onSave: (item) => {
      if (!saveDisabled) props.onSave(item);
    },
    onSaveAndAddAnother: props.onSaveAndAddAnother
      ? (item) => {
          if (!saveDisabled && props.onSaveAndAddAnother) {
            props.onSaveAndAddAnother(item);
          }
        }
      : undefined,
  });
  return (
    <div ref={dialogSurfaceRef} className="min-w-0">
      <InlineFormView
        form={dialogForm}
        week={props.week}
        products={props.products}
        activities={activities}
        showNextStep={showNextStep}
        showPriority={showPriority}
        confirmationOnly={confirmationOnly}
        saveDisabled={saveDisabled}
        onWeekChange={onWeekChange}
        weekChangeDisabled={props.weekChangeDisabled}
        nextStepTextareaRef={nextStepTextareaRef}
      />
      {discardDialog}
    </div>
  );
}
