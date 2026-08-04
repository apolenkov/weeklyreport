"use client";

import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/confirmation-dialog";
import type { ReportPeriod } from "../../report-sections";

export function useFillFromConfirmation(
  onFillFrom: ((sourceSectionId: string) => void) | undefined,
) {
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [open, setOpen] = useState(false);

  const dismiss = () => {
    setOpen(false);
    setPeriod(null);
  };

  return {
    period,
    open,
    // No period means there is nothing to fill from — stay closed.
    request: (next: ReportPeriod | undefined) => {
      if (!next) return;
      setPeriod(next);
      setOpen(true);
    },
    confirm: () => {
      if (period?.sourceSectionId) onFillFrom?.(period.sourceSectionId);
      dismiss();
    },
    cancel: dismiss,
  };
}

export function FillFromConfirmDialog({
  period,
  open,
  onConfirm,
  onClose,
}: {
  readonly period: ReportPeriod | null;
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  if (!period) return null;
  return (
    <ConfirmationDialog
      open={open}
      title={`Fill from ${period.weekLabel}?`}
      description={
        <>
          This will overwrite your current draft with data from{" "}
          <strong>
            {period.weekLabel} ({period.dateRange})
          </strong>
          . Current Week items, Risks, and Decisions will be replaced.
          Priorities will NOT be filled.
        </>
      }
      confirmLabel="Replace & Fill"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
