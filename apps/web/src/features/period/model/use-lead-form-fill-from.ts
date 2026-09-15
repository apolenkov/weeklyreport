"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { toast } from "sonner";

import type { LeadFormGeneration } from "../../report-sections";
import type { LeadFormWritePort } from "../../report-sections/client";
import {
  isLeadFormWriteConflict,
  useGenerationState,
} from "../../report-sections/client";

interface FillFromInput {
  readonly targetSectionId: string;
  readonly sourceSectionId: string;
  readonly version: number;
}

function useFillFromConfirmation(
  generation: LeadFormGeneration | null,
  autosaveDirty: boolean,
  createInput: (sourceSectionId: string) => FillFromInput | null,
  fillFrom: (input: FillFromInput) => Promise<void>,
) {
  const [pendingInput, setPendingInput] =
    useGenerationState<FillFromInput | null>(generation, null);
  return {
    pendingFillFrom: pendingInput !== null,
    handleFillFrom: (sourceSectionId: string) => {
      const input = createInput(sourceSectionId);
      if (input === null) return;
      if (autosaveDirty) {
        setPendingInput(input);
        return;
      }
      return fillFrom(input);
    },
    confirmPendingFillFrom: () => {
      if (pendingInput === null) return;
      const input = createInput(pendingInput.sourceSectionId);
      setPendingInput(null);
      if (input !== null) void fillFrom(input).catch(() => undefined);
    },
    cancelPendingFillFrom: () => setPendingInput(null),
  };
}

export function useLeadFormFillFrom({
  generation,
  sectionIdForActions,
  autosaveDirty,
  version,
  onConflict,
  onFilled,
  writePort,
}: {
  readonly generation: LeadFormGeneration | null;
  readonly sectionIdForActions: string | null;
  readonly autosaveDirty: boolean;
  readonly version: number;
  readonly onConflict: () => void;
  readonly onFilled: (section: ReportSectionReadModel) => void;
  readonly writePort: LeadFormWritePort;
}) {
  const fillFrom = async (input: FillFromInput) => {
    try {
      const result = await writePort.fillFrom(input);
      // Adopt the authoritative result as a self-write so the follow-up refetch
      // is not misreported as an external conflict.
      if (result.section) onFilled(result.section);
      toast.success("Form filled from selected period");
    } catch (error: unknown) {
      if (isLeadFormWriteConflict(error)) {
        onConflict();
        return;
      }
      const message =
        error instanceof Error ? error.message : "Fill from failed";
      toast.error(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const confirmation = useFillFromConfirmation(
    generation,
    autosaveDirty,
    (sourceSectionId) =>
      sectionIdForActions
        ? { targetSectionId: sectionIdForActions, sourceSectionId, version }
        : null,
    fillFrom,
  );

  return {
    fillFromPending: writePort.pending.fillFrom,
    ...confirmation,
  };
}
