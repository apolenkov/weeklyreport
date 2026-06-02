"use client";

import { useQuery } from "@tanstack/react-query";
import { FileDown, Presentation } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { useTRPC } from "../../lib/trpc-context";
import type { ReportPeriod } from "../lead/mock-data";
import { PeriodNavigator } from "../lead/period-navigator";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../report-shell/archive-toggle";
import { ReportToolbar } from "../report-shell/report-toolbar";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { HeadSlidesClient } from "../slides/head-slides-client";
import { SlideSkeleton } from "../slides/slide-skeleton";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";

interface HeadReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
}

/**
 * Phase 61 (robust-baking-aurora): inline form ↔ slides mode toggle for the
 * head status report page. Mirrors the pattern from lead-form.tsx.
 * UAT 2026-05-22 (done-condition 10): added period navigator + archive toggle
 * parity with the lead report toolbar. Head remains read-only — no version
 * browsing, no section editing.
 */
export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  const trpc = useTRPC();

  const [includeArchive, setIncludeArchive] = useState(false);

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );

  const periods: ReportPeriod[] = useMemo(() => {
    const data = historyQ.data;
    if (!data?.entries.length) return [];
    return data.entries.map((entry) => ({
      id: entry.reportId,
      weekLabel: `Week ${isoWeekNumber(new Date(entry.periodStart))}`,
      dateRange: formatDateRange(
        new Date(entry.periodStart),
        new Date(entry.periodEnd),
      ),
      archived: entry.archived,
      sourceSectionId: "",
      isCurrent: false,
      isSubmitted: true,
    }));
  }, [historyQ.data]);

  const urlBuilder = useCallback(
    (periodId: string) => {
      const base = `/head/report/${encodeURIComponent(periodId)}`;
      if (mode === "slides") return `${base}?mode=slides`;
      if (authorId) return `${base}?authorId=${encodeURIComponent(authorId)}`;
      return base;
    },
    [mode, authorId],
  );

  const authorSuffix = authorId
    ? `?authorId=${encodeURIComponent(authorId)}`
    : "";
  const editHref = `/head/report/${encodeURIComponent(reportId)}${authorSuffix}`;
  const slidesHref = `/head/report/${encodeURIComponent(reportId)}?mode=slides${
    authorId ? `&authorId=${encodeURIComponent(authorId)}` : ""
  }`;

  // Grouping axis for the form-mode status pane (UAT 2026-05-22): product (the
  // classic per-product list) or lead (products bucketed under each lead).
  const [scope, setScope] = useState<ScopeValue>("product");
  const reportScope = scope === "lead" ? "lead" : "product";

  const presentHref = `/head/report/${encodeURIComponent(reportId)}/present`;
  const printHref = `/print/${encodeURIComponent(reportId)}`;

  return (
    <div className="space-y-4">
      {/* Period toolbar parity with lead report (UAT 2026-05-22, done-condition 10):
          period navigator + archive toggle so head can switch between published weeks. */}
      <ReportToolbar
        periodNavigator={
          periods.length > 0 ? (
            <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
          ) : undefined
        }
        archiveToggle={
          <ArchiveToggle
            checked={includeArchive}
            onChange={setIncludeArchive}
          />
        }
      />
      {/* Action row parity with the lead report header (UAT 2026-05-22,
          done-condition 10): head is read-only, so the lead Submit slot is
          replaced by export / presentation actions. Same toolbar shape,
          scope + view-mode toggles share the row. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ScopeToggle
          value={scope}
          onChange={setScope}
          allowedScopes={["product", "lead"]}
        />
        <ViewModeToggle editHref={editHref} slidesHref={slidesHref} />
        <AgentReviewComingSoon />
        <a
          href={presentHref}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          aria-label="Open presentation"
          title="Presentation"
        >
          <Presentation className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Presentation</span>
        </a>
        <a
          href={printHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-2.5 py-1.5 text-white transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Export PDF"
          title="Export PDF"
        >
          <FileDown className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Export PDF</span>
        </a>
      </div>
      {mode === "slides" ? (
        <Suspense fallback={<SlideSkeleton />}>
          <HeadSlidesClient reportId={reportId} scope={reportScope} />
        </Suspense>
      ) : (
        <div className="min-w-0">
          <Suspense fallback={<WeeklyReportSkeleton />}>
            <WeeklyReportPage
              reportId={reportId}
              authorId={authorId}
              scope={reportScope}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
