"use client";

import { ConfirmationDialog } from "../../../../../shared/ui/dialogs/confirmation-dialog";

// The submit summary counts the lead's OWN records only — it reflects what will
// actually be submitted, never the foreign read-only records merged in for the
// Everyone lens.
interface SubmitConfirmCounts {
  readonly currentWeekItems: number;
  readonly nextWeekItems: number;
  readonly risks: number;
  readonly decisions: number;
}

const SUBMIT_COUNT_LABELS: readonly {
  readonly key: keyof SubmitConfirmCounts;
  readonly label: string;
}[] = [
  { key: "currentWeekItems", label: "current week items" },
  { key: "nextWeekItems", label: "next week items" },
  { key: "risks", label: "risks" },
  { key: "decisions", label: "decisions" },
];

function SubmitCountList({ counts }: { readonly counts: SubmitConfirmCounts }) {
  return (
    <div className="mt-3 space-y-1 text-sm">
      {SUBMIT_COUNT_LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="font-medium">{counts[key]}</span>
          <span className="text-[var(--color-muted-foreground)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

// Unset own stages are promoted to On Track on submit; say so before the fact.
function UnsetStageWarning({ count }: { readonly count: number }) {
  if (count <= 0) return null;
  return (
    <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
      {count} stage{count === 1 ? "" : "s"} not set — they will be marked On
      Track.
    </p>
  );
}

export function SubmitConfirmDialog({
  counts,
  unsetOwnStageCount,
  submitPending,
  onConfirm,
  onCancel,
}: {
  readonly counts: SubmitConfirmCounts;
  readonly unsetOwnStageCount: number;
  readonly submitPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmationDialog
      open
      onClose={onCancel}
      onConfirm={onConfirm}
      title="Confirm submission"
      description="Your report will be locked and visible to the group head. To change it later, request a reopen."
      confirmLabel="Submit"
      pendingLabel="Submitting…"
      isPending={submitPending}
    >
      <SubmitCountList counts={counts} />
      <UnsetStageWarning count={unsetOwnStageCount} />
    </ConfirmationDialog>
  );
}
