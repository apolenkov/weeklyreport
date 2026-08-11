"use client";

import type { AiProviderControlRead } from "@customreport/shared";

import { profileLabel } from "./ai-provider-form";

type AiProviderRetainedRevisionsProps = Readonly<{
  revisions: AiProviderControlRead["revisions"];
  activeRevisionId: string | null;
  busy: boolean;
  restorePending: boolean;
  onRestore: (revisionId: string) => void;
}>;

export function AiProviderRetainedRevisions({
  revisions,
  activeRevisionId,
  busy,
  restorePending,
  onRestore,
}: AiProviderRetainedRevisionsProps) {
  const retained = revisions.filter(({ id }) => id !== activeRevisionId);
  if (retained.length === 0) return null;

  return (
    <section className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-muted-foreground)] uppercase">
          Previous configurations
        </p>
        <h4 className="mt-1 text-sm font-semibold text-[var(--color-foreground)]">
          Retained revisions
        </h4>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Restore a previously active configuration without re-entering its
          credential.
        </p>
      </div>
      {retained.map((revision) => (
        <div
          className="flex flex-col gap-3 border-t border-[var(--color-border)] py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          key={revision.id}
        >
          <div className="text-[var(--color-muted-foreground)]">
            <span className="font-medium text-[var(--color-foreground)]">
              {profileLabel(revision.profile)}
            </span>{" "}
            · {revision.lifecycle} · {revision.embeddingModel} /{" "}
            {revision.embeddingDimensions}
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
        </div>
      ))}
    </section>
  );
}
