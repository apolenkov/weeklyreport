import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@weeklyreport/shared";
import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { hasPendingExecution } from "./ai-provider-configuration-fields.types";

type RevisionRead = AiProviderConfigurationRead;

type Confirmation = "activate" | "disable" | null;

const actionCopy = (
  lifecycle: RevisionRead["lifecycle"] | null,
  revisionId: string | null,
  executionPending: boolean,
): string => {
  if (executionPending)
    return "Wait for the capability test to finish before activating.";
  if (lifecycle === "validated") return "Activate this tested configuration.";
  if (lifecycle === "preparing") {
    return "Embedding preparation is ready to resume.";
  }
  if (lifecycle === "active") {
    return "Test this configuration or save a new draft.";
  }
  if (revisionId) return "Test the draft before activation.";
  return "Save as draft. Nothing changes until activation.";
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

const activateButtonLabel = (pending: boolean, preparing: boolean): string => {
  if (pending) return "Activating…";
  return preparing ? "Resume activation" : "Activate";
};

function CancelEditButton({ onCancel }: Readonly<{ onCancel: () => void }>) {
  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      onClick={onCancel}
    >
      Cancel edit
    </button>
  );
}

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
  onCancel,
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
  onCancel: (() => void) | undefined;
  setConfirmation: (confirmation: Confirmation) => void;
}>) {
  const preparing = revision?.lifecycle === "preparing";
  const executionPending = hasPendingExecution(revision);
  const canTest = revisionId !== null && !preparing && !executionPending;
  const canActivate =
    !executionPending &&
    (revision?.lifecycle === "validated" ||
      revision?.lifecycle === "preparing");
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || preparing}
      >
        {savePending ? "Saving…" : "Save draft"}
      </button>
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || !canTest}
        aria-describedby="ai-provider-action-guidance"
        onClick={() => {
          if (revisionId) onTest(revisionId);
        }}
      >
        {testButtonLabel(testPending, revision?.latestExecution?.state)}
      </button>
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || !canActivate}
        aria-describedby="ai-provider-action-guidance"
        onClick={() => setConfirmation("activate")}
      >
        {activateButtonLabel(activatePending, preparing)}
      </button>
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
      {onCancel && <CancelEditButton onCancel={onCancel} />}
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
  onCancel,
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
  onCancel: (() => void) | undefined;
}>) {
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p
        id="ai-provider-action-guidance"
        className="text-sm text-[var(--color-muted-foreground)]"
      >
        {actionCopy(
          revision?.lifecycle ?? null,
          revisionId,
          hasPendingExecution(revision),
        )}
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
        onCancel={onCancel}
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
