"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";
import {
  type DecisionEntry,
  type KanbanItem,
  type mapLeadFormData,
  type RiskEntry,
  sectionToDraftPayload,
} from "../../report-sections";
import type { GridRowEditableRef } from "../model/slide-grid-rows";
import {
  applySlideInlineDecisionEdit,
  applySlideInlineItemEdit,
  applySlideInlineRiskEdit,
  deleteSlideInlineRecord,
} from "../model/slide-inline-draft";
import {
  ownedStagesForProduct,
  ownPeriodRanks,
  resolveSlideInlineRecord,
  toDialogActivities,
  toDialogProducts,
  toDialogRisks,
} from "../model/slide-inline-edit";
import {
  getActiveDecisionRecord,
  getActiveItemRecord,
  getActiveRiskRecord,
  SlideInlineEditorDialogs,
} from "./slide-inline-editor-dialogs";

type LeadSlideFormData = NonNullable<ReturnType<typeof mapLeadFormData>>;

interface UseSlideInlineEditorArgs {
  readonly section: ReportSectionReadModel | null;
  readonly formData: LeadSlideFormData | null;
  readonly canInlineEdit: boolean;
  readonly refetchSection: () => void;
}

interface SlideInlineEditor {
  readonly onRowActivate?: (ref: GridRowEditableRef) => void;
  readonly dialogs: ReactNode;
}

export function useSlideInlineEditor({
  section,
  formData,
  canInlineEdit,
  refetchSection,
}: UseSlideInlineEditorArgs): SlideInlineEditor {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [inlineEditRef, setInlineEditRef] = useState<GridRowEditableRef | null>(
    null,
  );
  const [pendingDeleteRef, setPendingDeleteRef] =
    useState<GridRowEditableRef | null>(null);
  const saveOperationRef = useRef<"saved" | "deleted">("saved");

  const saveDraftMut = useMutation(
    // eslint-disable-next-line react-hooks/refs -- refs are touched inside mutation callbacks (event time); the options factory just runs during render
    trpc.reports.saveDraft.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        refetchSection();
        setInlineEditRef(null);
        setPendingDeleteRef(null);
        toast.success(
          saveOperationRef.current === "deleted"
            ? "Slide record deleted"
            : "Slide record saved",
        );
      },
      onError: (err: unknown) => {
        if (isConflictError(err)) {
          refetchSection();
          toast.error(
            "This section was changed elsewhere. Reloaded the latest version — re-apply your slide edit and save again.",
          );
          return;
        }
        toast.error(err instanceof Error ? err.message : "Slide save failed");
      },
    }),
  );

  const dialogProducts = useMemo(
    () => (formData ? toDialogProducts(formData) : []),
    [formData],
  );
  const dialogActivities = useMemo(
    () => (section ? toDialogActivities(section) : []),
    [section],
  );
  const dialogRanks = useMemo(
    () => (formData ? ownPeriodRanks(formData) : []),
    [formData],
  );
  const dialogRisks = useMemo(
    () => (formData ? toDialogRisks(formData) : []),
    [formData],
  );
  const inlineEditRecord = useMemo(
    () =>
      section && formData && inlineEditRef
        ? resolveSlideInlineRecord(section, formData, inlineEditRef)
        : null,
    [formData, inlineEditRef, section],
  );
  const pendingDeleteRecord = useMemo(
    () =>
      section && formData && pendingDeleteRef
        ? resolveSlideInlineRecord(section, formData, pendingDeleteRef)
        : null,
    [formData, pendingDeleteRef, section],
  );
  const activeItem = getActiveItemRecord(inlineEditRecord);
  const activeRisk = getActiveRiskRecord(inlineEditRecord);
  const activeDecision = getActiveDecisionRecord(inlineEditRecord);
  const stagesForProduct = (productId: string) =>
    section ? ownedStagesForProduct(section, productId) : [];

  function saveDraftSection(
    nextSection: ReportSectionReadModel,
    operation: "saved" | "deleted",
  ) {
    if (!canInlineEdit || section === null || saveDraftMut.isPending) return;
    saveOperationRef.current = operation;
    saveDraftMut.mutate({
      ...sectionToDraftPayload(nextSection),
      version: section.version,
    });
  }

  function handleRowActivate(ref: GridRowEditableRef) {
    if (!canInlineEdit || section === null || formData === null) return;
    if (resolveSlideInlineRecord(section, formData, ref) === null) return;
    setInlineEditRef(ref);
  }

  function requestInlineDelete() {
    if (inlineEditRecord === null || saveDraftMut.isPending) return;
    setPendingDeleteRef(inlineEditRecord.ref);
  }

  function confirmInlineDelete() {
    if (section === null || pendingDeleteRef === null) return;
    saveDraftSection(
      deleteSlideInlineRecord(section, pendingDeleteRef),
      "deleted",
    );
  }

  function handleItemSave(next: KanbanItem) {
    if (section === null || activeItem === null) return;
    saveDraftSection(
      applySlideInlineItemEdit(section, activeItem.ref.stableId, next),
      "saved",
    );
  }

  function handleRiskSave(next: RiskEntry) {
    if (section === null || activeRisk === null) return;
    saveDraftSection(
      applySlideInlineRiskEdit(section, activeRisk.ref.stableId, next),
      "saved",
    );
  }

  function handleDecisionSave(next: DecisionEntry) {
    if (section === null || activeDecision === null) return;
    saveDraftSection(
      applySlideInlineDecisionEdit(section, activeDecision.ref.stableId, next),
      "saved",
    );
  }

  return {
    onRowActivate: canInlineEdit ? handleRowActivate : undefined,
    dialogs: (
      <SlideInlineEditorDialogs
        inlineEditRecord={inlineEditRecord}
        pendingDeleteRecord={pendingDeleteRecord}
        currentUserName={formData?.currentUser.name}
        dialogProducts={dialogProducts}
        dialogActivities={dialogActivities}
        dialogRanks={dialogRanks}
        dialogRisks={dialogRisks}
        stagesForProduct={stagesForProduct}
        onItemSave={handleItemSave}
        onRiskSave={handleRiskSave}
        onDecisionSave={handleDecisionSave}
        onCancelEdit={() => setInlineEditRef(null)}
        onRequestDelete={requestInlineDelete}
        onConfirmDelete={confirmInlineDelete}
        onCancelDelete={() => setPendingDeleteRef(null)}
      />
    ),
  };
}
