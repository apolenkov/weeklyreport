"use client";

import { type ReactNode, type RefObject, useEffect, useRef } from "react";

const TEXTAREA_BORDER_ERROR =
  "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[var(--shadow-focus-destructive)]";
const TEXTAREA_BORDER_DEFAULT =
  "border-[var(--color-border-strong)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_var(--color-ring)]";

interface RecordTextareaFieldProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly minHeightPx?: number | undefined;
  readonly focusOnMount?: boolean | undefined;
  readonly textareaRef?: RefObject<HTMLTextAreaElement | null> | undefined;
  readonly hint?: ReactNode | undefined;
  readonly characterLimit?: number | undefined;
  // Extra ids (space-separated) that describe the textarea besides limit/error.
  readonly describedBy?: string | undefined;
  // When true, wrapper and textarea take flex-1 to fill a multi-field column;
  // false for a lone field with no height to share.
  readonly fill?: boolean | undefined;
  readonly disabled?: boolean | undefined;
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

function useInitialTextareaFocus(
  focusOnMount: boolean,
  elementRef: RefObject<HTMLTextAreaElement | null>,
): void {
  useEffect(() => {
    if (!focusOnMount) return;
    elementRef.current?.focus();
  }, [focusOnMount, elementRef]);
}

function textareaClassName(fill: boolean, hasError: boolean): string {
  const fillClass = fill ? "flex-1 " : "";
  const borderClass = hasError
    ? TEXTAREA_BORDER_ERROR
    : TEXTAREA_BORDER_DEFAULT;
  return `w-full ${fillClass}resize-y rounded-xl border bg-[var(--color-card)] px-3 py-2.5 text-base md:text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${borderClass}`;
}

function minHeightStyle(
  minHeightPx: number | undefined,
): { readonly minHeight: string } | undefined {
  return minHeightPx === undefined
    ? undefined
    : { minHeight: `${minHeightPx}px` };
}

export function RecordTextareaField({
  id,
  label,
  required = false,
  value,
  onChange,
  error,
  placeholder,
  minHeightPx,
  focusOnMount = false,
  textareaRef,
  hint,
  characterLimit,
  describedBy,
  fill = true,
  disabled = false,
}: RecordTextareaFieldProps) {
  const errorId = `${id}-error`;
  const limitId = `${id}-limit`;
  const hintId = `${id}-hint`;
  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  // React writes the element into this ref (the caller's when given, else the
  // field's own), so the focus effect only ever READS .current.
  const elementRef = textareaRef ?? ownRef;
  useInitialTextareaFocus(focusOnMount, elementRef);
  const characterCount = Array.from(value).length;
  const overBy =
    characterLimit === undefined
      ? 0
      : Math.max(0, characterCount - characterLimit);
  const isInvalid = Boolean(error) || overBy > 0;

  return (
    <div className={fill ? "flex flex-1 flex-col" : undefined}>
      <label
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
        htmlFor={id}
      >
        {label}
        {required ? " *" : ""}
      </label>
      {hint ? <div id={hintId}>{hint}</div> : null}
      <textarea
        id={id}
        name={id}
        autoComplete="off"
        ref={elementRef}
        required={required}
        disabled={disabled}
        aria-invalid={isInvalid ? "true" : "false"}
        aria-describedby={
          [
            hint ? hintId : undefined,
            characterLimit === undefined ? undefined : limitId,
            error ? errorId : undefined,
            describedBy,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={textareaClassName(fill, isInvalid)}
        style={minHeightStyle(minHeightPx)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {characterLimit !== undefined && (
        <p
          id={limitId}
          className={`mt-1 text-xs ${
            overBy > 0
              ? "text-[var(--color-destructive)]"
              : "text-[var(--color-muted-foreground)]"
          }`}
        >
          {characterCount} / {characterLimit} characters
          {overBy > 0 ? ` — ${overBy} over the limit` : ""}
        </p>
      )}
      {error && <FieldErrorMessage id={errorId} error={error} />}
    </div>
  );
}
