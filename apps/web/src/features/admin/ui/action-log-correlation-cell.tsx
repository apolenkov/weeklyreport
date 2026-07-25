"use client";

import { useState } from "react";

import { copyToClipboard, truncate } from "../model/action-log-format";

const MAX_REFERENCE_ID_LENGTH = 14;
const COPY_FEEDBACK_MS = 1500;

/**
 * Correlation Cell.
 * @param options - The options argument.
 */
export function CorrelationCell({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        // Fire-and-forget copy: the click handler is a void slot, so chain
        // off the promise instead of returning it.
        void copyToClipboard(value).then((ok) => {
          if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
          }
        });
      }}
      title={`${value} (click to copy)`}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      aria-label={`Copy reference id ${value}`}
    >
      <span>{truncate(value, MAX_REFERENCE_ID_LENGTH)}</span>
      <span
        className={`text-[10px] ${
          copied
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-muted-foreground)]"
        }`}
        aria-hidden="true"
      >
        {copied ? "✓ copied" : "📋"}
      </span>
    </button>
  );
}
