"use client";

import { Suspense } from "react";

import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";
import { HeadSlidesClient } from "../slides/head-slides-client";
import { SlideSkeleton } from "../slides/slide-skeleton";

type HeadReportShellProps = {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
};

/**
 * Phase 61 (robust-baking-aurora): inline form ↔ slides mode toggle for the
 * head status report page. Mirrors the pattern from lead-form.tsx.
 */
export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  const authorSuffix = authorId
    ? `?authorId=${encodeURIComponent(authorId)}`
    : "";
  const editHref = `/head/report/${encodeURIComponent(reportId)}${authorSuffix}`;
  const slidesHref =
    `/head/report/${encodeURIComponent(reportId)}?mode=slides` +
    (authorId ? `&authorId=${encodeURIComponent(authorId)}` : "");

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ViewModeToggle editHref={editHref} slidesHref={slidesHref} />
      </div>
      {mode === "slides" ? (
        <Suspense fallback={<SlideSkeleton />}>
          <HeadSlidesClient reportId={reportId} />
        </Suspense>
      ) : (
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReportPage reportId={reportId} authorId={authorId} />
        </Suspense>
      )}
    </div>
  );
}
