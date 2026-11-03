"use client";

import { type RefObject, useLayoutEffect } from "react";

import type { ItemInput, ItemTarget } from "../model/contextual-entry-contract";
import {
  persistableItemStatusToWorkflow,
  workflowToItemStatus,
} from "../model/item-status";
import type { ParentActivityOption } from "../model/record-parent";
import type { KanbanItem, Product } from "../model/types";
import type { ItemEditDraftStore } from "./item-edit-draft-store";
import { StatusOverviewInlineItemForm } from "./status-overview-inline-item-form";
import { useItemEditDialog } from "./use-item-edit-dialog";

export interface StatusOverviewInlineItemEditorProps {
  readonly target: ItemTarget;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly stagesForProduct: (productId: string) => readonly string[];
  readonly draftStore: ItemEditDraftStore;
  readonly currentUserName: string;
  readonly isPending?: boolean | undefined;
  readonly message?: string | null | undefined;
  readonly requestCloseRef?: RefObject<(() => void) | null> | undefined;
  readonly onSave: (item: KanbanItem) => void;
  readonly onSaveAndAddAnother: (item: KanbanItem) => void;
  readonly onCancel: () => void;
}

function useCloseRef(
  ref: RefObject<(() => void) | null> | undefined,
  close: () => void,
) {
  useLayoutEffect(() => {
    if (!ref) return;
    ref.current = close;
    return () => {
      ref.current = null;
    };
  }, [ref, close]);
}

function fieldErrors(
  form: Omit<
    ReturnType<typeof useItemEditDialog>,
    "dialogSurfaceRef" | "discardDialog"
  >,
) {
  const errors: Record<string, string> = {};
  if (form.textError) errors.text = form.textError;
  if (form.nextStepTextError) errors.nextStepText = form.nextStepTextError;
  if (form.parentError) errors.parent = form.parentError;
  if (form.stageError) errors.stageNames = form.stageError;
  if (form.pausedReasonError) errors.pausedReason = form.pausedReasonError;
  return errors;
}

function itemValue(
  form: Omit<
    ReturnType<typeof useItemEditDialog>,
    "dialogSurfaceRef" | "discardDialog"
  >,
): ItemInput {
  return {
    text: form.text,
    nextStepText: form.nextStepText,
    stageNames: form.stageNames,
    status: persistableItemStatusToWorkflow(form.status),
    pausedReason: form.pausedReason,
  };
}

export function StatusOverviewInlineItemEditor(
  props: StatusOverviewInlineItemEditorProps,
) {
  const { target } = props;
  const { dialogSurfaceRef, discardDialog, ...form } = useItemEditDialog({
    item: null,
    presentation: "inline",
    contextualCreateValidation: true,
    draftStore: props.draftStore,
    products: props.products.filter(
      (p) => target.parent.kind === "product" && p.id === target.parent.id,
    ),
    activities: props.activities.filter(
      (a) => target.parent.kind === "activity" && a.id === target.parent.id,
    ),
    week: target.week,
    currentUserName: props.currentUserName,
    stagesForProduct: props.stagesForProduct,
    onSave: props.onSave,
    onSaveAndAddAnother: props.onSaveAndAddAnother,
    onCancel: props.onCancel,
    isPending: props.isPending,
  });
  useCloseRef(props.requestCloseRef, form.requestClose);
  const value = itemValue(form);
  const errors = fieldErrors(form);
  return (
    <div
      role="presentation"
      ref={dialogSurfaceRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          form.requestClose();
        }
        if (
          event.key === "Enter" &&
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey
        ) {
          event.preventDefault();
          if (!props.isPending) form.handleSave();
        }
      }}
    >
      <StatusOverviewInlineItemForm
        target={target}
        value={value}
        view={{
          eligibleStages: form.availableStages,
          authorName: props.currentUserName,
          errors,
          message: props.message ?? null,
          pending: props.isPending ?? false,
          dirty: props.draftStore.isDirty(),
          canSubmit: true,
        }}
        onChange={(next) => {
          if (next.text !== value.text) form.onTextChange(next.text);
          if (next.nextStepText !== value.nextStepText)
            form.onNextStepTextChange(next.nextStepText);
          if (next.status !== value.status)
            form.onStatusSelect(workflowToItemStatus(next.status));
          if (next.pausedReason !== value.pausedReason)
            form.onPausedReasonChange(next.pausedReason);
          if (next.stageNames !== value.stageNames)
            form.onStageChange([...next.stageNames]);
        }}
        onSubmit={(mode) => {
          if (props.isPending) return;
          if (mode === "save") form.handleSave();
          else form.handleSaveAndAddAnother?.();
        }}
        onCancel={form.requestClose}
      />
      {discardDialog}
    </div>
  );
}
