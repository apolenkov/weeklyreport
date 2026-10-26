import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { useMemo } from "react";
import { toast } from "sonner";

import { logClientError } from "../../../shared/lib/errors/client-error-reporting";
import { mutationErrorMessage } from "../../../shared/lib/errors/mutation-error-message";
import { invalidateLeadForm } from "../../../shared/lib/query/cache-keys";
import { isConflictError } from "../../../shared/lib/trpc/trpc";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import {
  type MappedLeadForm,
  sectionToDraftPayload,
} from "../../report-sections";
import type { GridRowEditableRef } from "../model/slide-grid-rows";
import {
  ownedStagesForProduct,
  ownPeriodRanks,
  resolveSlideInlineRecord,
  toDialogActivities,
  toDialogProducts,
  toDialogRisks,
} from "../model/slide-inline-edit";
export type SaveOperation = "saved" | "deleted";

// A raw transport or input-validation payload is not actionable copy; curated
// domain messages are kept by the shared mutation error policy.
const SLIDE_SAVE_FAILURE_MESSAGE = "Slide save failed. Try again.";

// Single write path for inline save/delete; conflict reloads rather than toast-retrying.
export function useSlideDraftSaveMutation({
  refetchSection,
  onSaved,
}: {
  readonly refetchSection: () => Promise<unknown>;
  readonly onSaved: (sectionId: string) => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const saveDraftMut = useMutation(trpc.reports.saveDraft.mutationOptions());

  function saveDraftSection(
    section: ReportSectionReadModel,
    nextSection: ReportSectionReadModel,
    operation: SaveOperation,
  ) {
    if (saveDraftMut.isPending) return;
    saveDraftMut.mutate(
      {
        ...sectionToDraftPayload(nextSection),
        version: section.version,
      },
      {
        onSuccess: () => {
          invalidateLeadForm(qc, trpc);
          void refetchSection().catch(() => undefined);
          onSaved(section.reportSectionId);
          toast.success(
            operation === "deleted"
              ? "Slide record deleted"
              : "Slide record saved",
          );
        },
        onError: (err: unknown) => {
          if (!isConflictError(err)) {
            // Keep the raw failure for diagnostics; the toast shows either the
            // curated domain message or the safe generic copy.
            logClientError("slides.inlineEdit.save_failed", err, {
              component: "useSlideInlineEditor",
              procedure: "reports.saveDraft",
              reportSectionId: section.reportSectionId,
            });
            toast.error(mutationErrorMessage(err, SLIDE_SAVE_FAILURE_MESSAGE));
            return;
          }
          void refetchSection()
            .then(() => {
              toast.error(
                "This section was changed elsewhere. Reloaded the latest version — re-apply your slide edit and save again.",
              );
            })
            .catch(() => {
              toast.error(
                "This section was changed elsewhere. Reload failed — refresh the page and re-apply your slide edit.",
              );
            });
        },
      },
    );
  }

  return { saveDraftSection, isPending: saveDraftMut.isPending };
}

// Resolves one grid row (the open editor's or the pending delete's) back to its
// underlying record; null until section, formData and the row ref all exist.
function useSlideInlineRecord(
  section: ReportSectionReadModel | null,
  formData: MappedLeadForm | null,
  rowRef: GridRowEditableRef | null,
) {
  return useMemo(
    () =>
      section && formData && rowRef
        ? resolveSlideInlineRecord(section, formData, rowRef)
        : null,
    [formData, rowRef, section],
  );
}

// Pure lookups for dialog options and the open/pending-delete records — no local state.
export function useInlineEditDialogData({
  section,
  formData,
  inlineEditRef,
  pendingDeleteRef,
}: {
  readonly section: ReportSectionReadModel | null;
  readonly formData: MappedLeadForm | null;
  readonly inlineEditRef: GridRowEditableRef | null;
  readonly pendingDeleteRef: GridRowEditableRef | null;
}) {
  const fromFormData = useMemo(
    () => ({
      dialogProducts: formData ? toDialogProducts(formData) : [],
      dialogRanks: formData ? ownPeriodRanks(formData) : [],
      dialogRisks: formData ? toDialogRisks(formData) : [],
    }),
    [formData],
  );
  const dialogActivities = useMemo(
    () => (section ? toDialogActivities(section) : []),
    [section],
  );
  const inlineEditRecord = useSlideInlineRecord(
    section,
    formData,
    inlineEditRef,
  );
  const pendingDeleteRecord = useSlideInlineRecord(
    section,
    formData,
    pendingDeleteRef,
  );
  const stagesForProduct = (productId: string) =>
    section ? ownedStagesForProduct(section, productId) : [];

  return {
    ...fromFormData,
    dialogActivities,
    inlineEditRecord,
    pendingDeleteRecord,
    stagesForProduct,
  };
}
