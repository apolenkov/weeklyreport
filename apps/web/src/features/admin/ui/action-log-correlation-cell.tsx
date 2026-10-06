"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { copyToClipboard, shortId } from "../model/action-log-format";

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
      <div className="flex items-center gap-2">
        <code
          className="font-mono text-xs text-[var(--color-foreground)]"
          title={value}
        >
          {shortId(value)}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="btn-press inline-flex min-h-7 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 text-xs font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          aria-label={`Copy reference id ${value}`}
        >
          {copied ? (
            <Check
              aria-hidden="true"
              className="size-3.5 text-[var(--color-primary)]"
            />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
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
