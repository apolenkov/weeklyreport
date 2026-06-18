"use client";

import { LayoutGrid, Pencil } from "lucide-react";
import Link from "next/link";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

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
  // Compact icon-only segments in the neutral family. The two segments stay
  // `<Link>` URL navigation (slides is a separate route; `scroll={false}`), so
  // middle-click / open-in-new-tab still work. Each keeps an accessible name via
  // aria-label + tooltip now that the label is an icon.
  return (
    <SegmentedToggle ariaLabel="View mode">
      <Link
        href={editHref}
        scroll={false}
        title="Edit"
        className={segmentClassName(mode === "edit", { iconOnly: true })}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Edit</span>
      </Link>
      <Link
        href={slidesHref}
        scroll={false}
        title="Slides"
        className={segmentClassName(mode === "slides", { iconOnly: true })}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Slides</span>
      </Link>
    </SegmentedToggle>
  );
}
