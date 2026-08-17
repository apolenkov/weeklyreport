import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@customreport/shared";

type RevisionRead =
  NonNullable<AiProviderControlRead["active"]> | AiProviderConfigurationRead;

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
  const preparing = revision?.lifecycle === "preparing";
  const nextAction = preparing
    ? "Embedding preparation finished or was interrupted. Resume activation to complete the active pointer switch."
    : revisionId
      ? "Test this saved draft before making it active."
      : "Save a draft first. It will not affect anyone yet.";

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {nextAction}
      </p>
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
            disabled={busy || preparing}
            onClick={() => onTest(revisionId)}
          >
            {testPending ? "Testing…" : "Test capabilities"}
          </button>
        )}
        {(revision?.lifecycle === "validated" || preparing) && (
          <button
            type="button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Activate this AI provider globally?")) {
                onActivate(revision.id);
              }
            }}
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
            onClick={() => {
              if (window.confirm("Disable AI for all users?")) onDisable();
            }}
          >
            {disablePending ? "Disabling…" : "Disable"}
          </button>
        )}
      </div>
    </div>
  );
}
