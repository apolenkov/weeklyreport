import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

interface RetryContext {
  readonly setError: (error: string | null) => void;
}

// After a possibly delivered write only the identical immutable request may be
// sent again, at its original version and identities; later typing stays in
// the composer and is saved by a separate, later Save.
export function retryOriginalSave(
  context: RetryContext,
  editor: ReadyEditor,
  token: string,
): void {
  const recovery = editor.draft.saveRecovery;
  const retried =
    recovery?.phase === "ambiguous" &&
    recovery.token === token &&
    editor.draft.retrySameAttempt?.(token) === true;
  context.setError(
    retried
      ? null
      : "The original save has not been confirmed. Your input is retained; another Save cannot resolve this outcome.",
  );
}
