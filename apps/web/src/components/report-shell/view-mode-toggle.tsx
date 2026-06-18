"use client";

import Link from "next/link";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

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
  // Neutral segmented family via the shared primitive. The two segments stay
  // `<Link>` URL navigation (slides is a separate route; `scroll={false}`),
  // so middle-click / open-in-new-tab still work. The primitive's track keeps
  // the segments touching as ONE pill even inside a parent `gap-*` flex row
  // (the lead header), which a bare gap previously split (user-reported
  // 2026-06-10).
  return (
    <SegmentedToggle ariaLabel="View mode">
      <Link
        href={editHref}
        scroll={false}
        className={segmentClassName(mode === "edit")}
      >
        Edit
      </Link>
      <Link
        href={slidesHref}
        scroll={false}
        className={segmentClassName(mode === "slides")}
        aria-label="Open slides mode"
      >
        <SlidesViewIcon />
        Slides
      </Link>
    </SegmentedToggle>
  );
}
