import type { SearchHit } from "@customreport/shared";
import { useEffect, useState } from "react";

export type SearchScope = "mine" | "all" | "published";

export const DEBOUNCE_MS = 300;
export const MIN_LEN = 2;
export const MAX_LEN = 200;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// No `#section-<id>` fragment: lead form has no matching id target (dead scroll).
/**
 * Target Url For.
 * @param hit - The hit argument.
 * @param isViewer - The isViewer argument.
 */
export function targetUrlFor(hit: SearchHit, isViewer: boolean): string {
  if (hit.type === "project") {
    // Viewer has no product surface; project hits are excluded server- and client-side.
    return isViewer ? "#" : `/admin?tab=products&filter=${hit.id}`;
  }
  if (hit.reportId) {
    // Viewer item/risk/decision hits go to the read-only published report, not the lead form.
    return isViewer
      ? `/reports/${hit.reportId}`
      : `/lead/report/${hit.reportId}`;
  }
  return "#";
}

export const TYPE_BADGE: Record<
  SearchHit["type"],
  { label: string; aria: string }
> = {
  item: { label: "Task", aria: "Task match" },
  risk: { label: "Risk", aria: "Risk match" },
  decision: { label: "Decision", aria: "Decision match" },
  project: { label: "Product", aria: "Product match" },
};

/** Length of the `<<` / `>>` snippet markers, stripped when unwrapping a match. */
const SNIPPET_MARKER_LENGTH = 2;

// Stable keys per chunk so React can reconcile highlight marks across re-renders.
/**
 * Render Snippet.
 * @param snippet - The snippet argument.
 */
export function renderSnippet(snippet: string): React.ReactNode {
  if (!snippet) return null;
  // eslint-disable-next-line sonarjs/super-linear-regex -- server-generated literal markers, negated class + lazy quantifier, bounded input
  const parts = snippet.split(/(<<[^>]*?>>)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("<<") && part.endsWith(">>")) {
      const inner = part.slice(SNIPPET_MARKER_LENGTH, -SNIPPET_MARKER_LENGTH);
      return (
        <mark
          key={`m-${idx.toString()}`}
          className="rounded-[2px] bg-[var(--color-success)] px-[2px] text-[var(--color-foreground)]"
        >
          {inner}
        </mark>
      );
    }
    return <span key={`t-${idx.toString()}`}>{part}</span>;
  });
}
