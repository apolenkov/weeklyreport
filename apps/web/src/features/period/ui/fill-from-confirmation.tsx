"use client";

import Link from "next/link";
import { useState } from "react";

import { countLabel } from "../../../shared/lib/format/pluralize";
import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { REPORTS_ROUTE } from "../../../shared/ui/navigation/nav-links";
import type { ReportPeriod } from "../../report-sections";

export type FillFromHandler = (sourceSectionId: string) => void | Promise<void>;

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Fill from failed. Try again.";
}

export function useFillFromConfirmation(
  onFillFrom: FillFromHandler | undefined,
) {
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => {
    setOpen(false);
    setPeriod(null);
    setError(null);
  };

  return {
    period,
    open,
    pending,
    error,
    // No period means there is nothing to fill from — stay closed.
    request: (next: ReportPeriod | undefined) => {
      if (!next) return;
      setPeriod(next);
      setError(null);
      setOpen(true);
    },
    confirm: () => {
      const sourceSectionId = period?.sourceSectionId;
      if (!sourceSectionId || !onFillFrom) {
        dismiss();
        return;
      }
      setPending(true);
      setError(null);
      const runFillFrom = async () => {
        try {
          await onFillFrom(sourceSectionId);
          dismiss();
        } catch (error_: unknown) {
          setError(errorMessage(error_));
        } finally {
          setPending(false);
        }
      };
      void runFillFrom();
    },
    cancel: dismiss,
  };
}

// Fill From copies finished records only. The source week's unfinished drafts
// stay there; the note points at History, where their author can read them.
function UncopiedDraftsNote({ count }: { readonly count: number }) {
  if (count === 0) return null;
  return (
    <p className="mb-2 text-sm text-[var(--color-muted-foreground)]">
      {countLabel(count, "unfinished draft", "unfinished drafts")} from that
      week will not be copied. You can read {count === 1 ? "it" : "them"} in{" "}
      <Link
        href={REPORTS_ROUTE}
        className="font-semibold text-[var(--color-starbucks-accent)] underline underline-offset-2"
      >
        History
      </Link>
      .
    </p>
  );
}

export function FillFromConfirmDialog({
  period,
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  readonly period: ReportPeriod | null;
  readonly open: boolean;
  readonly pending: boolean;
  readonly error: string | null;
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
      confirmLabel="Replace & fill"
      isPending={pending}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <UncopiedDraftsNote count={period.retainedDraftCount ?? 0} />
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </ConfirmationDialog>
  );
}
