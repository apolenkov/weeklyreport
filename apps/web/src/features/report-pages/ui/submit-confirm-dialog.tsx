"use client";

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

function SubmitConfirmActions({
  submitPending,
  onConfirm,
  onCancel,
}: {
  readonly submitPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onConfirm}
        disabled={submitPending}
      >
        Submit
      </button>
    </div>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm submission"
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          Submit your report?
        </h3>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Your report will be locked and visible to the group head. You will not
          be able to make changes after submission.
        </p>
        <SubmitCountList counts={counts} />
        <UnsetStageWarning count={unsetOwnStageCount} />
        <SubmitConfirmActions
          submitPending={submitPending}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
