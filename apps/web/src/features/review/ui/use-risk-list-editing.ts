"use client";

import { useEffect, useState } from "react";

import type {
  CreateSeed,
  EditableListDialogState,
  UseEditableListDialogResult,
} from "../../../hooks/use-editable-list-dialog";
import { useEditableListDialog } from "../../../hooks/use-editable-list-dialog";
import type { RiskEntry } from "../../report-sections";

type SavedRisk = RiskEntry & { impact: string; mitigation: string };

// Each signal increment opens create prefilled with product/stage/severity.
export interface RiskAddPrefill {
  signal: number;
  productId: string;
  stageIds: string[];
  severity: "at-risk" | "blocked";
  // Pill raise — preselects the activity parent.
  activityId?: string;
}

interface RiskCreatePrefill {
  readonly stageIds?: string[];
  readonly severity?: "at-risk" | "blocked";
}

interface RiskListEditingOptions {
  readonly risks: RiskEntry[];
  readonly readOnly: boolean;
  readonly onChange?: (next: RiskEntry[]) => void;
  readonly addSignal: number;
  readonly addPrefill?: RiskAddPrefill;
  readonly seedProductId?: string;
}

export interface RiskListEditing extends UseEditableListDialogResult<RiskEntry> {
  readonly createPrefill: RiskCreatePrefill | null;
  readonly requestDeleteById: (id: string) => void;
  readonly confirmDelete: () => void;
  readonly toggleSeverity: (risk: RiskEntry) => void;
  readonly saveFromDialog: (saved: SavedRisk) => void;
  readonly cancelDialog: () => void;
}

const withoutRisk = (risks: RiskEntry[], id: string): RiskEntry[] =>
  risks.filter((risk) => risk.id !== id);

// applyRiskSeverityFloor re-derives the stage chips, so a blocked→at-risk flip
// lowers the covered stage without opening the edit dialog.
function withToggledSeverity(
  risks: RiskEntry[],
  target: RiskEntry,
): RiskEntry[] {
  const severity = target.severity === "blocked" ? "at-risk" : "blocked";
  return risks.map((risk) =>
    risk.id === target.id ? { ...risk, severity } : risk,
  );
}

const nextRisksAfterSave = (
  dialogState: EditableListDialogState<RiskEntry>,
  risks: RiskEntry[],
  saved: SavedRisk,
): RiskEntry[] =>
  dialogState.open && dialogState.mode === "create"
    ? [...risks, saved]
    : risks.map((risk) => (risk.id === saved.id ? saved : risk));

// Chip-raise prefill lives caller-side; cleared on close so a plain +Add opens
// with no stage/severity carried over from the raise.
function useRiskRaisePrefill(
  addPrefill: RiskAddPrefill | undefined,
  openCreate: (seed?: CreateSeed) => void,
) {
  const [createPrefill, setCreatePrefill] = useState<RiskCreatePrefill | null>(
    null,
  );

  useEffect(() => {
    if (!addPrefill || addPrefill.signal === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes the addPrefill SIGNAL prop (an event delivered via props); state updates are the event's handler
    setCreatePrefill({
      stageIds: addPrefill.stageIds,
      severity: addPrefill.severity,
    });
    openCreate({
      productId: addPrefill.productId,
      activityId: addPrefill.activityId,
    });
  }, [addPrefill, openCreate]);

  return [createPrefill, setCreatePrefill] as const;
}

// Dialog lifecycle plus the risk-list mutations the section hands to its cards.
export function useRiskListEditing({
  risks,
  readOnly,
  onChange,
  addSignal,
  addPrefill,
  seedProductId,
}: RiskListEditingOptions): RiskListEditing {
  // requireSeed is false: a risk can be created before any product exists.
  const dialog = useEditableListDialog<RiskEntry>({
    readOnly,
    addSignal,
    seedProductId,
  });
  const [createPrefill, setCreatePrefill] = useRiskRaisePrefill(
    addPrefill,
    dialog.openCreate,
  );

  return {
    ...dialog,
    createPrefill,
    requestDeleteById: (id) => {
      const risk = risks.find((entry) => entry.id === id);
      if (risk) dialog.requestDelete(risk);
    },
    confirmDelete: () => {
      if (!dialog.pendingDelete) return;
      onChange?.(withoutRisk(risks, dialog.pendingDelete.id));
      dialog.clearPendingDelete();
    },
    toggleSeverity: (risk) => {
      if (readOnly) return;
      onChange?.(withToggledSeverity(risks, risk));
    },
    saveFromDialog: (saved) => {
      if (readOnly) return;
      onChange?.(nextRisksAfterSave(dialog.dialogState, risks, saved));
      setCreatePrefill(null);
      dialog.close();
    },
    cancelDialog: () => {
      setCreatePrefill(null);
      dialog.close();
    },
  };
}
