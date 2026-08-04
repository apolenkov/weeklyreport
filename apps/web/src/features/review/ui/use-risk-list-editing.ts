"use client";

import { useEffect, useReducer, useRef } from "react";

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
  stageNames: readonly string[];
  severity: "at-risk" | "blocked";
  // Pill raise — preselects the activity parent.
  activityId?: string | undefined;
}

interface RiskCreatePrefill {
  readonly stageNames?: readonly string[] | undefined;
  readonly severity?: "at-risk" | "blocked" | undefined;
}

interface RiskListEditingOptions {
  readonly risks: readonly RiskEntry[];
  readonly readOnly: boolean;
  readonly onChange?: ((next: readonly RiskEntry[]) => void) | undefined;
  readonly addSignal: number;
  readonly addPrefill?: RiskAddPrefill | undefined;
  readonly seedProductId?: string | undefined;
}

export interface RiskListEditing extends UseEditableListDialogResult<RiskEntry> {
  readonly createPrefill: RiskCreatePrefill | null;
  readonly requestDeleteById: (id: string) => void;
  readonly confirmDelete: () => void;
  readonly toggleSeverity: (risk: RiskEntry) => void;
  readonly saveFromDialog: (saved: SavedRisk) => void;
  readonly cancelDialog: () => void;
}

const withoutRisk = (risks: readonly RiskEntry[], id: string): RiskEntry[] =>
  risks.filter((risk) => risk.id !== id);

// applyRiskSeverityFloor re-derives the stage chips, so a blocked→at-risk flip
// lowers the covered stage without opening the edit dialog.
function withToggledSeverity(
  risks: readonly RiskEntry[],
  target: RiskEntry,
): RiskEntry[] {
  const severity = target.severity === "blocked" ? "at-risk" : "blocked";
  return risks.map((risk) =>
    risk.id === target.id ? { ...risk, severity } : risk,
  );
}

const nextRisksAfterSave = (
  dialogState: EditableListDialogState<RiskEntry>,
  risks: readonly RiskEntry[],
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
  const lastHandledSignal = useRef(0);
  const [createPrefill, setCreatePrefill] = useReducer(
    (_current: RiskCreatePrefill | null, next: RiskCreatePrefill | null) =>
      next,
    null,
  );

  useEffect(() => {
    if (!addPrefill || addPrefill.signal === 0) return;
    if (addPrefill.signal <= lastHandledSignal.current) return;
    lastHandledSignal.current = addPrefill.signal;
    setCreatePrefill({
      stageNames: addPrefill.stageNames,
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
