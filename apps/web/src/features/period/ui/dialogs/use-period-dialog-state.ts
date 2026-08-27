"use client";

import type { PeriodListItem } from "@customreport/shared";
import { useEffect, useRef, useState } from "react";

export interface PeriodDialogState {
  readonly showCreate: boolean;
  readonly editingRow: PeriodListItem | null;
  readonly deleteConfirm: PeriodListItem | null;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
  readonly openEdit: (row: PeriodListItem) => void;
  readonly closeEdit: () => void;
  readonly requestDelete: (row: PeriodListItem) => void;
  readonly closeDelete: () => void;
}

// Captures the opener so focus can return after the corresponding dialog closes.
function useRestoreFocusOnClose(openState: unknown) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openState && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [openState]);

  return () => {
    triggerRef.current = document.activeElement as HTMLElement;
  };
}

export function usePeriodDialogState(): PeriodDialogState {
  const [showCreate, setShowCreate] = useState(false);
  const [editingRow, setEditingRow] = useState<PeriodListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PeriodListItem | null>(
    null,
  );
  const captureCreateTrigger = useRestoreFocusOnClose(showCreate);
  const captureEditTrigger = useRestoreFocusOnClose(editingRow);

  return {
    showCreate,
    editingRow,
    deleteConfirm,
    openCreate: () => {
      captureCreateTrigger();
      setShowCreate(true);
    },
    closeCreate: () => setShowCreate(false),
    openEdit: (row) => {
      captureEditTrigger();
      setEditingRow(row);
    },
    closeEdit: () => setEditingRow(null),
    requestDelete: setDeleteConfirm,
    closeDelete: () => setDeleteConfirm(null),
  };
}
