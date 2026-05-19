"use client";

import Link from "next/link";

export type SectionContributor = {
  authorId: string;
  authorName: string;
  /** -1 means count is unavailable for this section type. */
  count: number;
  /** singular/plural label for the count, e.g. "risk" / "risks" */
  label: string;
};

type Props = {
  readonly contributors: readonly SectionContributor[];
  readonly reportId: string;
  /**
   * F14: when true, renders a "Show details ▾ / Hide ▴" toggle button
   * after the "readonly ↗" link so the parent can expand an inline embed.
   */
  readonly expandable?: boolean;
  /** F14: controlled expanded state — ignored when expandable is false. */
  readonly expanded?: boolean;
  /** F14: called when the user clicks the expand/collapse toggle. */
  readonly onToggleExpand?: () => void;
};

/**
 * F9: Compact "Other contributors" strip rendered at the top of each section
 * when a cross-author lead is also contributing to the same section type.
 * Links to the foreign-author readonly view (P63 LOCK-01).
 *
 * F14: when expandable=true, adds a toggle button to show/hide inline embeds.
 */
export function CrossAuthorHint({
  contributors,
  reportId,
  expandable = false,
  expanded = false,
  onToggleExpand,
}: Props) {
  if (contributors.length === 0) return null;
  return (
    <div className="mb-3 flex flex-col gap-1">
      {contributors.map((ca) => (
        <div
          key={ca.authorId}
          className="flex items-center gap-1.5 rounded-md border border-[rgba(0,0,0,0.08)] bg-[var(--color-muted-tint,rgba(0,0,0,0.03))] px-3 py-1.5 text-xs text-[var(--color-muted-foreground)]"
        >
          <span aria-hidden="true" className="select-none">
            🔒
          </span>
          <span>
            Also contributing:{" "}
            <span className="font-medium text-[var(--color-foreground)]">
              {ca.authorName}
            </span>
            {ca.count >= 0 && (
              <span>
                {" "}
                ({ca.count} {ca.label})
              </span>
            )}
          </span>
          <Link
            href={`/lead/report/${reportId}?authorId=${ca.authorId}`}
            className="ml-auto whitespace-nowrap font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
            aria-label={`View ${ca.authorName}'s section in read-only mode`}
          >
            readonly ↗
          </Link>
          {expandable && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={onToggleExpand}
              className="ml-1 whitespace-nowrap font-medium text-[var(--color-muted-foreground)] underline-offset-2 hover:text-[var(--color-foreground)] hover:underline"
            >
              {expanded ? "Hide ▴" : "Show details ▾"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
