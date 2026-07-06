"use client";

import { FileText, LayoutGrid, Pencil } from "lucide-react";
import Link from "next/link";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

interface ViewModeToggleProps {
  readonly editHref: string;
  readonly slidesHref: string;
  readonly mode?: "edit" | "slides";
  /**
   * When true the non-slides segment is labeled "Report" with a document icon
   * instead of "Edit"/pencil. The viewer report surface is strictly read-only
   * (no Publish/Lock, no section editing), so a pencil "Edit" affordance there
   * is misleading; the head surface keeps "Edit" since it carries lifecycle
   * actions in that mode. (viewer-report-surface-parity review P3.)
   */
  readonly readOnly?: boolean;
}

export function ViewModeToggle({
  editHref,
  slidesHref,
  mode = "edit",
  readOnly = false,
}: ViewModeToggleProps) {
  // Compact icon-only segments in the neutral family. The two segments stay
  // `<Link>` URL navigation (slides is a separate route; `scroll={false}`), so
  // middle-click / open-in-new-tab still work. Each keeps an accessible name via
  // aria-label + tooltip now that the label is an icon.
  const reportLabel = readOnly ? "Report" : "Edit";
  return (
    <SegmentedToggle ariaLabel="View mode">
      <Link
        href={editHref}
        scroll={false}
        title={reportLabel}
        className={segmentClassName(mode === "edit", { iconOnly: true })}
      >
        {readOnly ? (
          <FileText className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pencil className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">{reportLabel}</span>
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
