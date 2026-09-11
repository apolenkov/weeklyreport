"use client";

import { FileText, LayoutGrid, ListTree, Pencil } from "lucide-react";
import Link from "next/link";

import { segmentClassName, SegmentedToggle } from "./segmented-toggle";

interface ViewModeToggleProps {
  readonly overviewHref?: string;
  readonly editHref: string;
  readonly slidesHref: string;
  readonly mode?: "overview" | "edit" | "slides";
  // Viewer is read-only — pencil "Edit" is misleading; head keeps "Edit".
  readonly readOnly?: boolean;
  readonly desktopLabels?: boolean;
}

export function ViewModeToggle({
  overviewHref,
  editHref,
  slidesHref,
  mode = "edit",
  readOnly = false,
  desktopLabels = false,
}: ViewModeToggleProps) {
  // <Link> segments keep middle-click / open-in-new-tab; slides is its own route.
  const reportLabel = readOnly ? "Report" : "Edit";
  const labelClassName = desktopLabels ? "sr-only lg:not-sr-only" : "sr-only";
  return (
    <SegmentedToggle ariaLabel="View mode">
      {overviewHref ? (
        <Link
          href={overviewHref}
          scroll={false}
          title="Overview"
          aria-current={mode === "overview" ? "page" : undefined}
          className={segmentClassName(mode === "overview", {
            iconOnly: true,
            desktopLabels,
          })}
        >
          <ListTree className="h-4 w-4" aria-hidden="true" />
          <span className={labelClassName}>Overview</span>
        </Link>
      ) : null}
      <Link
        href={editHref}
        scroll={false}
        title={reportLabel}
        aria-current={mode === "edit" ? "page" : undefined}
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
        <span className={labelClassName}>{reportLabel}</span>
      </Link>
      <Link
        href={slidesHref}
        scroll={false}
        title="Slides"
        aria-current={mode === "slides" ? "page" : undefined}
        className={segmentClassName(mode === "slides", {
          iconOnly: true,
          desktopLabels,
        })}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        <span className={labelClassName}>Slides</span>
      </Link>
    </SegmentedToggle>
  );
}
