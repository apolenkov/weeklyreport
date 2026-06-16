"use client";

import Link from "next/link";

function SlidesViewIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h18v16H3z" />
      <path d="M9 4v16M15 4v16" />
      <path d="M3 10h18" />
    </svg>
  );
}

interface ViewModeToggleProps {
  readonly editHref: string;
  readonly slidesHref: string;
  readonly mode?: "edit" | "slides";
}

export function ViewModeToggle({
  editHref,
  slidesHref,
  mode = "edit",
}: ViewModeToggleProps) {
  // Neutral pill family matching the lead "Toggle All" button so the whole
  // toolbar reads as one family (user direction 2026-06-16): gray border,
  // transparent inactive, neutral --color-muted fill on the active segment.
  const activeClass = "bg-[var(--color-muted)] text-[var(--color-foreground)]";
  const inactiveClass =
    "bg-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]";

  // Self-contained wrapper: the two segments must touch to read as ONE
  // segmented pill. Without it, a parent flex container with `gap-*`
  // (e.g. the lead header) splits the pill into two broken halves
  // (user-reported 2026-06-10).
  return (
    <div className="inline-flex items-center">
      <Link
        href={editHref}
        scroll={false}
        className={`inline-flex min-h-[var(--touch-target-min)] min-w-[96px] items-center justify-center gap-1 rounded-l-[var(--radius-pill)] border border-r-0 border-[rgba(0,0,0,0.2)] px-3 text-sm font-semibold transition-colors ${mode === "edit" ? activeClass : inactiveClass}`}
      >
        Edit
      </Link>
      <Link
        href={slidesHref}
        scroll={false}
        className={`inline-flex min-h-[var(--touch-target-min)] min-w-[96px] items-center justify-center gap-1 rounded-r-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] px-3 text-sm font-semibold transition-colors ${mode === "slides" ? activeClass : inactiveClass}`}
        aria-label="Open slides mode"
      >
        <SlidesViewIcon />
        Slides
      </Link>
    </div>
  );
}
