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

type ViewModeToggleProps = {
  readonly editHref: string;
  readonly slidesHref: string;
};

export function ViewModeToggle({ editHref, slidesHref }: ViewModeToggleProps) {
  return (
    <>
      <Link
        href={editHref}
        scroll={false}
        className="inline-flex h-10 min-w-[96px] items-center justify-center gap-1 rounded-l-[var(--radius-pill)] border border-r-0 border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-3 text-sm font-semibold text-white transition-colors"
      >
        Edit
      </Link>
      <Link
        href={slidesHref}
        scroll={false}
        className="inline-flex h-10 min-w-[96px] items-center justify-center gap-1 rounded-r-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors"
        aria-label="Open slides mode"
      >
        <SlidesViewIcon />
        Slides
      </Link>
    </>
  );
}
