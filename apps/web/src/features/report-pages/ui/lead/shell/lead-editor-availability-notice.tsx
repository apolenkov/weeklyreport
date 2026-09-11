import type { LeadFormEditorHandle } from "./use-lead-form-editor";

export function EditorAvailabilityNotice({
  editor,
}: {
  readonly editor: LeadFormEditorHandle;
}) {
  if (editor.status === "ready") return null;
  const failed = editor.status === "error";
  return (
    <div
      role={failed ? "alert" : "status"}
      className="border-l-2 border-[var(--color-status-at-risk-border)] pl-3 text-sm text-[var(--color-muted-foreground)]"
    >
      <p>
        {failed
          ? "Editing is temporarily unavailable. Overview remains read-only."
          : editor.status === "loading"
            ? "Loading editing controls… Overview is temporarily read-only."
            : editor.status === "no-active"
              ? "No active reporting period is available. Overview is read-only."
              : "This report section is not editable. Overview is read-only."}
      </p>
      {editor.status === "error" && (
        <button
          type="button"
          onClick={editor.retry}
          disabled={editor.isRetrying}
          className="mt-2 min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-50"
        >
          {editor.isRetrying ? "Retrying editing…" : "Retry editing"}
        </button>
      )}
    </div>
  );
}
