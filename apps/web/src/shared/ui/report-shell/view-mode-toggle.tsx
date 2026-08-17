"use client";

import { FileText, LayoutGrid, Pencil } from "lucide-react";
import Link from "next/link";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

interface ViewModeToggleProps {
  readonly editHref: string;
  readonly slidesHref: string;
  readonly mode?: "edit" | "slides";
  // Viewer is read-only — pencil "Edit" is misleading; head keeps "Edit".
  readonly readOnly?: boolean;
  readonly desktopLabels?: boolean;
}

export function ViewModeToggle({
  editHref,
  slidesHref,
  mode = "edit",
  readOnly = false,
  desktopLabels = false,
}: ViewModeToggleProps) {
  // <Link> segments keep middle-click / open-in-new-tab; slides is its own route.
  const reportLabel = readOnly ? "Report" : "Edit";
  return (
    <SegmentedToggle ariaLabel="View mode">
      <Link
        href={editHref}
        scroll={false}
        title={reportLabel}
        className={segmentClassName(mode === "edit", {
          iconOnly: true,
          desktopLabels,
        })}
      >
        {readOnly ? (
          <FileText className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Pencil className="h-4 w-4" aria-hidden="true" />
        )}
        <span className={desktopLabels ? "sr-only lg:not-sr-only" : "sr-only"}>
          {reportLabel}
        </span>
      </Link>
      <Link
        href={slidesHref}
        scroll={false}
        title="Slides"
        className={segmentClassName(mode === "slides", {
          iconOnly: true,
          desktopLabels,
        })}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        <span className={desktopLabels ? "sr-only lg:not-sr-only" : "sr-only"}>
          Slides
        </span>
      </Link>
    </SegmentedToggle>
  );
}
