"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { copyToClipboard, truncate } from "../model/action-log-format";

const MAX_REFERENCE_ID_LENGTH = 14;
const COPY_FEEDBACK_MS = 1500;

export function CorrelationCell({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  const feedbackTimer = useRef<number | null>(null);

  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (!ok) {
      toast.error(
        "Copy failed — your browser may have blocked clipboard access",
      );
      return;
    }
    setCopied(true);
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => {
      setCopied(false);
      feedbackTimer.current = null;
    }, COPY_FEEDBACK_MS);
  }

  useEffect(() => {
    return () => {
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => void handleCopy()}
        title={`${value} (click to copy)`}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        aria-label={`Copy reference id ${value}`}
      >
        <span>{truncate(value, MAX_REFERENCE_ID_LENGTH)}</span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${
            copied
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-muted-foreground)]"
          }`}
          aria-hidden="true"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              <span>Copied</span>
            </>
          ) : (
            <Copy className="size-3" />
          )}
        </span>
      </button>
      {copied ? (
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Copied
        </span>
      ) : null}
    </>
  );
}
