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
  // When true, wrapper and textarea take flex-1 to fill a multi-field column;
  // false for a lone field with no height to share.
  readonly fill?: boolean;
}

function FieldErrorMessage({
  id,
  error,
}: {
  readonly id: string;
  readonly error: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1 text-xs text-[var(--color-destructive)]"
    >
      {error}
    </p>
  );
}

/**
 * Record Textarea Field.
 * @param props - The props argument.
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
      {error && <FieldErrorMessage id={errorId} error={error} />}
    </div>
  );
}
