"use client";

import { SAFE_TEXT_MAX_LENGTH, safeText } from "@weeklyreport/shared";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

function ReasonActions({
  busy,
  onCancel,
}: {
  readonly busy: boolean;
  readonly onCancel: () => void;
}) {
  return (
    <>
      <button
        type="submit"
        disabled={busy}
        className={`min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 ${FOCUS_RING}`}
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className={`min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 ${FOCUS_RING}`}
      >
        Cancel
      </button>
    </>
  );
}

function reasonError(reason: string, message: string | undefined): string {
  return reason.trim() === ""
    ? "Add a one-line reason."
    : (message ?? "Add a visible reason.");
}

interface ReasonRowProps {
  readonly label: string;
  readonly placeholder: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (reason: string) => void;
  readonly onCancel: () => void;
}

export function ReasonRow({
  label,
  placeholder,
  busy,
  error,
  onSubmit,
  onCancel,
}: ReasonRowProps) {
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (busy) return;
    input.current?.focus();
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [busy]);
  const errorId = useId();
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = safeText().safeParse(reason);
    if (!parsed.success) {
      setInvalid(reasonError(reason, parsed.error.issues[0]?.message));
      input.current?.focus();
      return;
    }
    onSubmit(parsed.data);
  };
  const message = invalid ?? error;
  return (
    <form
      onSubmit={submit}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
      className="flex min-w-0 flex-col gap-1"
      data-testid="overview-status-reason"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <input
          ref={input}
          type="text"
          name="status-reason"
          autoComplete="off"
          value={reason}
          maxLength={SAFE_TEXT_MAX_LENGTH}
          disabled={busy}
          aria-label={label}
          aria-invalid={message !== null}
          aria-describedby={message === null ? undefined : errorId}
          placeholder={placeholder}
          onChange={(event) => {
            setReason(event.target.value);
            setInvalid(null);
          }}
          className={`min-h-[var(--touch-target-min)] min-w-0 basis-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 text-sm ${FOCUS_RING}`}
        />
        <ReasonActions busy={busy} onCancel={onCancel} />
      </div>
      {message === null ? null : (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--color-destructive)]"
        >
          {message}
        </p>
      )}
    </form>
  );
}
