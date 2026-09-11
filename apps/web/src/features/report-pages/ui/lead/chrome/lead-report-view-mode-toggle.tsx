"use client";

import { FileText, LayoutGrid } from "lucide-react";
import Link from "next/link";

import {
  segmentClassName,
  SegmentedToggle,
} from "../../../../../shared/ui/report-shell/segmented-toggle";

export function LeadReportViewModeToggle({
  mode,
  reportHref,
  slidesHref,
  desktopLabels,
}: {
  readonly mode: "report" | "slides";
  readonly reportHref: string;
  readonly slidesHref: string;
  readonly desktopLabels: boolean;
}) {
  const labelClassName = desktopLabels ? "sr-only lg:not-sr-only" : "sr-only";
  return (
    <SegmentedToggle ariaLabel="View mode">
      <Link
        href={reportHref}
        scroll={false}
        title="Report"
        aria-current={mode === "report" ? "page" : undefined}
        className={segmentClassName(mode === "report", {
          iconOnly: true,
          desktopLabels,
        })}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        <span className={labelClassName}>Report</span>
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
