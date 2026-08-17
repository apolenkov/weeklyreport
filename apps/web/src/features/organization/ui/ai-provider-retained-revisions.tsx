"use client";

import type { AiProviderControlRead } from "@customreport/shared";

import { profileLabel } from "./ai-provider-form";

type AiProviderRetainedRevisionsProps = Readonly<{
  revisions: AiProviderControlRead["revisions"];
  activeRevisionId: string | null;
  busy: boolean;
  restorePending: boolean;
  discardPending: boolean;
  onRestore: (revisionId: string) => void;
  onDiscard: (revisionId: string) => void;
}>;

export function AiProviderRetainedRevisions({
  revisions,
  activeRevisionId,
  busy,
  restorePending,
  discardPending,
  onRestore,
  onDiscard,
}: AiProviderRetainedRevisionsProps) {
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
        <div
          className="flex flex-col gap-2 border-t border-[var(--color-border)] py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
          key={revision.id}
        >
          <div className="text-[var(--color-muted-foreground)]">
            <span className="font-medium text-[var(--color-foreground)]">
              {profileLabel(revision.generation.profile)}
            </span>{" "}
            · {revision.lifecycle} · {revision.embeddings.model} /{" "}
            {revision.embeddings.dimensions}
            {revision.lifecycle === "preparing" && (
              <span data-testid="ai-retained-preparation-progress">
                {" "}
                · {revision.progress.completed}/{revision.progress.total}{" "}
                complete · {revision.progress.failed} failed ·{" "}
                {revision.progress.elapsedMs} ms
              </span>
            )}
          </div>
          {revision.lifecycle === "superseded" && (
            <button
              type="button"
              className="btn-press shrink-0 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm("Restore this retained AI provider globally?")
                ) {
                  onRestore(revision.id);
                }
              }}
            >
              {restorePending ? "Restoring…" : "Restore"}
            </button>
          )}
          {(revision.lifecycle === "draft" ||
            revision.lifecycle === "failed") && (
            <button
              type="button"
              className="btn-press shrink-0 rounded-[var(--radius-pill)] border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Discard this AI provider attempt? Its credential cannot be restored.",
                  )
                )
                  onDiscard(revision.id);
              }}
            >
              {discardPending ? "Discarding…" : "Discard"}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
