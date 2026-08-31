import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@customreport/shared";
import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";

type RevisionRead = AiProviderConfigurationRead;

type Confirmation = "activate" | "disable" | null;

const actionCopy = (preparing: boolean, revisionId: string | null): string => {
  if (preparing) {
    return "Embedding preparation finished or was interrupted. Resume activation to complete the active pointer switch.";
  }
  if (revisionId) return "Test this saved draft before making it active.";
  return "Save a draft first. It will not affect anyone yet.";
};

const testButtonLabel = (
  testPending: boolean,
  state: NonNullable<RevisionRead["latestExecution"]>["state"] | undefined,
): string => {
  if (testPending) return "Testing…";
  if (state === "queued") return "Queued…";
  if (state === "running") return "Testing…";
  return "Test capabilities";
};

const hasPendingExecution = (revision: RevisionRead | null): boolean => {
  const state = revision?.latestExecution?.state;
  return state === "queued" || state === "running";
};

function ProviderActionButtons({
  revision,
  revisionId,
  availability,
  busy,
  savePending,
  testPending,
  activatePending,
  disablePending,
  onTest,
  setConfirmation,
}: Readonly<{
  revision: RevisionRead | null;
  revisionId: string | null;
  availability: AiProviderControlRead["availability"];
  busy: boolean;
  savePending: boolean;
  testPending: boolean;
  activatePending: boolean;
  disablePending: boolean;
  onTest: (revisionId: string) => void;
  setConfirmation: (confirmation: Confirmation) => void;
}>) {
  const preparing = revision?.lifecycle === "preparing";
  const executionPending = hasPendingExecution(revision);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || preparing}
      >
        {savePending ? "Saving…" : "Save draft"}
      </button>
      {revisionId && (
        <button
          type="button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || preparing || executionPending}
          onClick={() => onTest(revisionId)}
        >
          {testButtonLabel(testPending, revision?.latestExecution?.state)}
        </button>
      )}
      {(revision?.lifecycle === "validated" || preparing) && (
        <button
          type="button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => setConfirmation("activate")}
        >
          {activatePending
            ? "Activating…"
            : preparing
              ? "Resume activation"
              : "Activate"}
        </button>
      )}
      {availability === "available" && (
        <button
          type="button"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => setConfirmation("disable")}
        >
          {disablePending ? "Disabling…" : "Disable"}
        </button>
      )}
    </div>
  );
}

export function AiProviderActions({
  revision,
  revisionId,
  availability,
  busy,
  savePending,
  testPending,
  activatePending,
  disablePending,
  onTest,
  onActivate,
  onDisable,
}: Readonly<{
  revision: RevisionRead | null;
  revisionId: string | null;
  availability: AiProviderControlRead["availability"];
  busy: boolean;
  savePending: boolean;
  testPending: boolean;
  activatePending: boolean;
  disablePending: boolean;
  onTest: (revisionId: string) => void;
  onActivate: (revisionId: string) => void;
  onDisable: () => void;
}>) {
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const preparing = revision?.lifecycle === "preparing";

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {actionCopy(preparing, revisionId)}
      </p>
      <ProviderActionButtons
        revision={revision}
        revisionId={revisionId}
        availability={availability}
        busy={busy}
        savePending={savePending}
        testPending={testPending}
        activatePending={activatePending}
        disablePending={disablePending}
        onTest={onTest}
        setConfirmation={setConfirmation}
      />
      <ConfirmationDialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation === "activate" && revision) onActivate(revision.id);
          if (confirmation === "disable") onDisable();
          setConfirmation(null);
        }}
        title={
          confirmation === "activate"
            ? "Activate AI provider?"
            : "Disable AI for all users?"
        }
        description={
          confirmation === "activate"
            ? "Make this tested AI provider available to all users."
            : "Turn off AI provider access for all users."
        }
        confirmLabel={confirmation === "activate" ? "Activate" : "Disable"}
        variant={confirmation === "disable" ? "destructive" : "default"}
      />
    </div>
  );
}
