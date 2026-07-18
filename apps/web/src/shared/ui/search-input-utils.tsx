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

/**
 * Resolve the click-through URL for a search hit.
 *
 * Items/risks/decisions deep-link into the addressed lead form
 * `/lead/report/<reportId>`. Project hits deep-link to /admin?tab=products
 * with a filter query param.
 *
 * No `#section-<id>` fragment is emitted: `/lead/report/[reportId]` is a
 * type-organized form with no `id="section-<reportSectionId>"` target, so
 * the anchor never resolved and only produced a dead scroll. Strip it
 * rather than render a per-section-UUID target the form is not shaped for.
 */
export function targetUrlFor(hit: SearchHit, isViewer: boolean): string {
  if (hit.type === "project") {
    // A viewer has no product surface (Decision 3); project hits are excluded
    // server-side and filtered client-side, so this is a defensive dead-end.
    return isViewer ? "#" : `/admin?tab=products&filter=${hit.id}`;
  }
  if (hit.reportId) {
    // viewer-report-surface-parity (Decision 4): a viewer's item/risk/decision
    // hits route to the read-only published report, never the lead form.
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

/**
 * Render a snippet with `<<` / `>>` markers as <mark> elements. The
 * function returns a stable key for each chunk so React can reconcile
 * highlights across re-renders.
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
