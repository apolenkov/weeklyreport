import type { WeeklyReportReadModel } from "@weeklyreport/shared";

import { mapWeeklyReport } from "../../../features/report-sections/model/weekly-report";
import {
  formatDateTime,
  joinPeriodLabel,
} from "../../../shared/lib/format/format-date";
import { buildPrintActivityReports } from "./print-activity-projection";
import { PrintExecutiveSummary } from "./print-executive-summary";
import {
  PrintActivityReports,
  PrintPortfolioOverview,
  PrintProductReports,
  PrintReportFooter,
  PrintReportHeader,
} from "./print-report-sections";
import { PRINT_STATE, SHELL_STYLE } from "./print-report-shell";
import { PrintReportStyles } from "./print-report-styles";

interface PrintReportTemplateProps {
  readonly data: WeeklyReportReadModel;
}

// Server-rendered by design: the renderer's ready contract
// (data-print-state="ready" + loaded fonts) is satisfied from SSR markup, so
// PDF conversion never depends on client hydration in the embedded browser.
export function PrintReportTemplate({ data }: PrintReportTemplateProps) {
  const view = mapWeeklyReport(data);
  const activityReports = buildPrintActivityReports(data.leadSections);
  const summaryReports = [...view.products, ...activityReports];
  const blockedCount = summaryReports.filter(
    (report) => report.status === "blocked",
  ).length;
  const atRiskCount = summaryReports.filter(
    (report) => report.status === "at-risk",
  ).length;
  const decisionCount = summaryReports.reduce(
    (sum, report) => sum + report.decisions.length,
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
        <PrintActivityReports reports={activityReports} />
        <PrintReportFooter
          generatedAt={formatDateTime(new Date())}
          reportId={view.period.reportId}
        />
      </main>
    </>
  );
}
