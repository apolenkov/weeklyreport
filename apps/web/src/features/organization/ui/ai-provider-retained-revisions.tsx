"use client";

import type { AiProviderControlRead } from "@customreport/shared";
import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import { profileLabel } from "./ai-provider-form";

type AiProviderRetainedRevisionsProps = Readonly<{
  revisions: AiProviderControlRead["revisions"];
  activeRevisionId: string | null;
  busy: boolean;
  restorePendingRevisionId: string | null;
  discardPendingRevisionId: string | null;
  onRestore: (revisionId: string) => void;
  onDiscard: (revisionId: string) => void;
}>;

function RetainedRevisionRow({
  revision,
  busy,
  restorePending,
  discardPending,
  onRequest,
}: Readonly<{
  revision: AiProviderControlRead["revisions"][number];
  busy: boolean;
  restorePending: boolean;
  discardPending: boolean;
  onRequest: (action: "restore" | "discard") => void;
}>) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[var(--color-muted-foreground)]">
        <span className="font-medium text-[var(--color-foreground)]">
          {profileLabel(revision.generation.profile)}
        </span>{" "}
        · {revision.lifecycle} · {revision.embeddings.model} /{" "}
        {revision.embeddings.dimensions}
        {revision.lifecycle === "preparing" && (
          <span data-testid="ai-retained-preparation-progress">
            {" "}
            · {revision.progress.completed}/{revision.progress.total} complete ·{" "}
            {revision.progress.failed} failed · {revision.progress.elapsedMs} ms
          </span>
        )}
      </div>
      {revision.lifecycle === "superseded" && (
        <button
          type="button"
          className="btn-press min-h-[var(--touch-target-min)] shrink-0 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => onRequest("restore")}
        >
          {restorePending ? "Restoring…" : "Restore"}
        </button>
      )}
      {(revision.lifecycle === "draft" || revision.lifecycle === "failed") && (
        <button
          type="button"
          className="btn-press min-h-[var(--touch-target-min)] shrink-0 rounded-[var(--radius-pill)] border border-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-[var(--color-destructive)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-status-blocked-bg)] hover:bg-[var(--color-status-blocked-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => onRequest("discard")}
        >
          {discardPending ? "Discarding…" : "Discard"}
        </button>
      )}
    </div>
  );
}

export function AiProviderRetainedRevisions({
  revisions,
  activeRevisionId,
  busy,
  restorePendingRevisionId,
  discardPendingRevisionId,
  onRestore,
  onDiscard,
}: AiProviderRetainedRevisionsProps) {
  const [confirmation, setConfirmation] = useState<{
    action: "restore" | "discard";
    revisionId: string;
  } | null>(null);
  const retained = revisions.filter(({ id }) => id !== activeRevisionId);
  if (retained.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-muted-foreground)] uppercase">
          Previous configurations
        </p>
        <h4 className="mt-1 text-sm font-semibold text-[var(--color-foreground)]">
          Retained revisions
        </h4>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Restore a previous configuration or discard an unsuccessful attempt.
        </p>
      </div>
      {retained.map((revision) => (
        <RetainedRevisionRow
          key={revision.id}
          revision={revision}
          busy={busy}
          restorePending={restorePendingRevisionId === revision.id}
          discardPending={discardPendingRevisionId === revision.id}
          onRequest={(action) =>
            setConfirmation({ action, revisionId: revision.id })
          }
        />
      ))}
      <ConfirmationDialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.action === "restore")
            onRestore(confirmation.revisionId);
          else onDiscard(confirmation.revisionId);
          setConfirmation(null);
        }}
        title={
          confirmation?.action === "restore"
            ? "Restore AI provider?"
            : "Discard AI provider attempt?"
        }
        description={
          confirmation?.action === "restore"
            ? "Make this retained configuration active for all users."
            : "Discard this attempt. Its credential cannot be restored."
        }
        confirmLabel={
          confirmation?.action === "restore" ? "Restore" : "Discard"
        }
        variant={confirmation?.action === "discard" ? "destructive" : "default"}
      />
    </section>
  );
}
