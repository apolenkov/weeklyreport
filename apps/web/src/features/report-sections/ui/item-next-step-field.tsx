"use client";

import type { Ref } from "react";

import type { ItemStatus } from "../model/types";

const NEXT_STEP_MAX_LENGTH = 500;

interface NextStepFieldProps {
  readonly value: string;
  readonly error: string | undefined;
  readonly status: ItemStatus;
  readonly onChange: (next: string) => void;
  readonly textareaRef?: Ref<HTMLTextAreaElement> | undefined;
}

// A next step is a separate carry-over commitment, never a rewrite of the
// current-period result in Description.
export function NextStepField({
  value,
  error,
  status,
  onChange,
  textareaRef,
}: NextStepFieldProps) {
  const errorId = "item-next-step-error";
  const pausedNoticeId = "item-next-step-paused-notice";
  const describedBy = [
    error ? errorId : undefined,
    status === "paused" ? pausedNoticeId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor="item-next-step"
      >
        Next step <span className="font-normal">(optional)</span>
      </label>
      <p className="mb-1 text-xs text-[var(--color-muted-foreground)]">
        What should carry forward after this update?
      </p>
      <textarea
        id="item-next-step"
        name="item-next-step"
        autoComplete="off"
        ref={textareaRef}
        maxLength={NEXT_STEP_MAX_LENGTH}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy || undefined}
        className={`w-full resize-y rounded-xl border bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
          error
            ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[var(--shadow-focus-destructive)]"
            : "border-[var(--color-border-strong)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)]"
        }`}
        style={{ minHeight: "52px" }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Describe the next concrete step…"
      />
      {status === "paused" ? (
        <p
          id={pausedNoticeId}
          role="status"
          className="mt-1 text-xs text-[var(--color-muted-foreground)]"
        >
          This plan is retained, but carry-over is suspended until you resume
          this item.
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
