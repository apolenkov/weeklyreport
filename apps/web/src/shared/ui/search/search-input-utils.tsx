import type { SearchHit } from "@customreport/shared";
import { useEffect, useState } from "react";

import { ADMIN_ROUTE } from "../navigation/nav-links";

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
// An unavailable hit has no real destination — never a "#" placeholder that
// would jump the page as if it were a link.
export type SearchTarget =
  | { readonly kind: "navigable"; readonly url: string }
  | { readonly kind: "unavailable" };

export function targetUrlFor(hit: SearchHit, isViewer: boolean): SearchTarget {
  if (hit.type === "project") {
    // Viewer has no product surface; project hits are excluded server- and
    // client-side, so a stray hit is an unavailable result, not a page jump.
    if (isViewer) return { kind: "unavailable" };
    return {
      kind: "navigable",
      url: `${ADMIN_ROUTE}?tab=products&filter=${hit.id}`,
    };
  }
  if (hit.reportId) {
    // Viewer item/risk/decision hits go to the read-only published report,
    // not the lead form.
    return {
      kind: "navigable",
      url: isViewer
        ? `/reports/${hit.reportId}`
        : `/lead/report/${hit.reportId}`,
    };
  }
  return { kind: "unavailable" };
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

// Marker width used when unwrapping server-highlighted snippets.
const SNIPPET_MARKER_LENGTH = 2;

// Stable keys per chunk so React can reconcile highlight marks across re-renders.
// The server wraps each match in literal `<<…>>` markers; split + indexOf bounds
// the scan to one linear pass with no regex backtracking.
export function renderSnippet(snippet: string): React.ReactNode {
  if (!snippet) return null;
  const parts = splitSnippetMarkers(snippet);
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

function splitSnippetMarkers(snippet: string): readonly string[] {
  const [head = "", ...chunks] = snippet.split("<<");
  return [
    head,
    ...chunks.flatMap((chunk) => {
      const close = chunk.indexOf(">>");
      if (close === -1) return [`<<${chunk}`];
      return [
        `<<${chunk.slice(0, close + SNIPPET_MARKER_LENGTH)}`,
        chunk.slice(close + SNIPPET_MARKER_LENGTH),
      ];
    }),
  ];
}
