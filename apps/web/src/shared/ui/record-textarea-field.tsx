"use client";

import type { ReactNode, Ref } from "react";

const TEXTAREA_BORDER_ERROR =
  "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]";
const TEXTAREA_BORDER_DEFAULT =
  "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]";

interface RecordTextareaFieldProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  readonly placeholder?: string;
  readonly minHeightPx?: number;
  readonly autoFocus?: boolean;
  readonly textareaRef?: Ref<HTMLTextAreaElement>;
  readonly hint?: ReactNode;
  /**
   * Whether the field and its wrapper absorb extra column height via flex-1.
   * The item/risk/decision dialogs mix flex-1 fields (which fill a flex
   * column alongside sibling fields) with plain fields (a lone field with no
   * height to share) — this toggles both the wrapper and the textarea's own
   * flex-1 class so each field keeps its dialog's exact layout.
   */
  readonly fill?: boolean;
}

/**
 * The label + textarea + inline-error block repeated across the item, risk
 * and decision record dialogs.
 */
export function RecordTextareaField({
  id,
  label,
  required = false,
  value,
  onChange,
  error,
  placeholder,
  minHeightPx,
  autoFocus = false,
  textareaRef,
  hint,
  fill = true,
}: RecordTextareaFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={fill ? "flex flex-1 flex-col" : undefined}>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor={id}
      >
        {label}
        {required ? " *" : ""}
      </label>
      {hint}
      <textarea
        id={id}
        ref={textareaRef}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
        autoFocus={autoFocus}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
        className={`w-full ${fill ? "flex-1 " : ""}resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
          error ? TEXTAREA_BORDER_ERROR : TEXTAREA_BORDER_DEFAULT
        }`}
        style={
          minHeightPx !== undefined
            ? { minHeight: `${minHeightPx}px` }
            : undefined
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
