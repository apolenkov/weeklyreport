import type { ReportSectionReadModel } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { toast } from "sonner";

import { invalidateLeadForm } from "../../../lib/cache-keys";
import { isConflictError } from "../../../lib/trpc";
import { useTRPC } from "../../../lib/trpc-context";
import { sectionToDraftPayload } from "../../report-sections";
import type { GridRowEditableRef } from "../model/slide-grid-rows";
import {
  ownedStagesForProduct,
  ownPeriodRanks,
  resolveSlideInlineRecord,
  toDialogActivities,
  toDialogProducts,
  toDialogRisks,
} from "../model/slide-inline-edit";
import type { LeadSlideFormData } from "./lead-slide-form-data";

export type { LeadSlideFormData } from "./lead-slide-form-data";
export type SaveOperation = "saved" | "deleted";

// Single write path for inline save/delete; conflict reloads rather than toast-retrying.
export function useSlideDraftSaveMutation({
  refetchSection,
  onSaved,
}: {
  readonly refetchSection: () => void;
  readonly onSaved: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const saveOperationRef = useRef<SaveOperation>("saved");

  const saveDraftMut = useMutation(
    // eslint-disable-next-line react-hooks/refs -- refs are touched inside mutation callbacks (event time); the options factory just runs during render
    trpc.reports.saveDraft.mutationOptions({
      onSuccess: () => {
        invalidateLeadForm(qc, trpc);
        refetchSection();
        onSaved();
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

  function saveDraftSection(
    section: ReportSectionReadModel,
    nextSection: ReportSectionReadModel,
    operation: SaveOperation,
  ) {
    if (saveDraftMut.isPending) return;
    saveOperationRef.current = operation;
    saveDraftMut.mutate({
      ...sectionToDraftPayload(nextSection),
      version: section.version,
    });
  }

  return { saveDraftSection, isPending: saveDraftMut.isPending };
}

// Pure lookups for dialog options and the open/pending-delete records — no local state.
export function useInlineEditDialogData({
  section,
  formData,
  inlineEditRef,
  pendingDeleteRef,
}: {
  readonly section: ReportSectionReadModel | null;
  readonly formData: LeadSlideFormData | null;
  readonly inlineEditRef: GridRowEditableRef | null;
  readonly pendingDeleteRef: GridRowEditableRef | null;
}) {
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
  const stagesForProduct = (productId: string) =>
    section ? ownedStagesForProduct(section, productId) : [];

  return {
    dialogProducts,
    dialogActivities,
    dialogRanks,
    dialogRisks,
    inlineEditRecord,
    pendingDeleteRecord,
    stagesForProduct,
  };
}
