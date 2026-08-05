"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  mapWeeklyReport,
  type MapWeeklyReportResult,
} from "../../../features/report-sections";
import { formatClientErrorMessage } from "../../../shared/lib/errors/client-error-reporting";
import {
  formatDateTime,
  joinPeriodLabel,
} from "../../../shared/lib/format/format-date";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { PrintExecutiveSummary } from "./print-executive-summary";
import {
  PrintPortfolioOverview,
  PrintProductReports,
  PrintReportFooter,
  PrintReportHeader,
} from "./print-report-sections";
import {
  ErrorShell,
  LoadingShell,
  PRINT_STATE,
  SHELL_STYLE,
} from "./print-report-shell";
import { PrintReportStyles } from "./print-report-styles";

interface PrintReportTemplateProps {
  readonly reportId: string;
}

function ReadyReport({
  reportId,
  view,
}: {
  readonly reportId: string;
  readonly view: MapWeeklyReportResult;
}) {
  const blockedCount = view.products.filter(
    (product) => product.status === "blocked",
  ).length;
  const atRiskCount = view.products.filter(
    (product) => product.status === "at-risk",
  ).length;
  const decisionCount = view.products.reduce(
    (sum, product) => sum + product.decisions.length,
    0,
  );
  const periodLabel = joinPeriodLabel(
    view.period.weekLabel,
    view.period.dateRange,
  );
  return (
    <>
      <PrintReportStyles />
      <main
        id="main-content"
        tabIndex={-1}
        data-print-state={PRINT_STATE.ready}
        style={{ ...SHELL_STYLE, lineHeight: "1.5", letterSpacing: "-0.01em" }}
      >
        <PrintReportHeader
          periodLabel={periodLabel}
          submissionSummary={`${view.submissionCount}/${view.totalLeads} leads submitted`}
        />
        <PrintExecutiveSummary
          submitted={view.submissionCount}
          total={view.totalLeads}
          blockedCount={blockedCount}
          atRiskCount={atRiskCount}
          decisionCount={decisionCount}
        />
        <PrintPortfolioOverview view={view} />
        <PrintProductReports view={view} />
        <PrintReportFooter
          generatedAt={formatDateTime(new Date())}
          reportId={reportId}
        />
      </main>
    </>
  );
}

export function PrintReportTemplate({ reportId }: PrintReportTemplateProps) {
  const trpc = useTRPC();
  const weeklyQuery = useQuery(
    trpc.weeklyReport.get.queryOptions({ reportId }),
  );

  useEffect(() => {
    if (weeklyQuery.isError) {
      toast.error(
        formatClientErrorMessage("Failed to load report", weeklyQuery.error),
      );
    }
  }, [weeklyQuery.isError, weeklyQuery.error]);

  if (weeklyQuery.isError || weeklyQuery.data?.status === "no-period") {
    return <ErrorShell reportId={reportId} />;
  }
  if (weeklyQuery.isLoading || !weeklyQuery.data) {
    return <LoadingShell reportId={reportId} />;
  }
  return (
    <ReadyReport reportId={reportId} view={mapWeeklyReport(weeklyQuery.data)} />
  );
}
