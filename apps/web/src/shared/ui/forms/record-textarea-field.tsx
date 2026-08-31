"use client";

import { type ReactNode, type Ref, useEffect, useRef } from "react";

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
  readonly textareaRef?: Ref<HTMLTextAreaElement> | undefined;
  readonly hint?: ReactNode | undefined;
  // When true, wrapper and textarea take flex-1 to fill a multi-field column;
  // false for a lone field with no height to share.
  readonly fill?: boolean | undefined;
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
  elementRef: Exclude<Ref<HTMLTextAreaElement>, null>,
): void {
  useEffect(() => {
    if (!focusOnMount) return;
    const node = "current" in elementRef ? elementRef.current : null;
    node?.focus();
  }, [focusOnMount, elementRef]);
}

function textareaClassName(fill: boolean, hasError: boolean): string {
  const fillClass = fill ? "flex-1 " : "";
  const borderClass = hasError
    ? TEXTAREA_BORDER_ERROR
    : TEXTAREA_BORDER_DEFAULT;
  return `w-full ${fillClass}resize-y rounded-xl border bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${borderClass}`;
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
  fill = true,
}: RecordTextareaFieldProps) {
  const errorId = `${id}-error`;
  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  // React writes the element into this ref (the caller's when given, else the
  // field's own), so the focus effect only ever READS .current.
  const elementRef = textareaRef ?? ownRef;
  useInitialTextareaFocus(focusOnMount, elementRef);

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
        name={id}
        autoComplete="off"
        ref={elementRef}
        required={required}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
        className={textareaClassName(fill, Boolean(error))}
        style={minHeightStyle(minHeightPx)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error && <FieldErrorMessage id={errorId} error={error} />}
    </div>
  );
}
