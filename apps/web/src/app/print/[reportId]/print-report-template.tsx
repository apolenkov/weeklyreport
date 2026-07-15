"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  mapWeeklyReport,
  type MapWeeklyReportResult,
} from "../../../features/report-sections/model/weekly-report";
import { formatClientErrorMessage } from "../../../lib/client-error-reporting";
import { formatDateTime, joinPeriodLabel } from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";
import { PrintExecutiveSummary } from "./print-executive-summary";
import { PrintLeadSection } from "./print-lead-section";
import { PrintPortfolioTable } from "./print-portfolio-table";
import { PrintReportStyles } from "./print-report-styles";
import {
  BORDER_LIGHT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./print-report-theme";

const PRINT_STATE = {
  loading: "loading",
  error: "error",
  ready: "ready",
} as const;

const SHELL_STYLE = {
  backgroundColor: "#ffffff",
  color: TEXT_PRIMARY,
  fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "12px",
  maxWidth: "210mm",
  margin: "0 auto",
  padding: "24px",
} as const;

interface PrintReportTemplateProps {
  readonly reportId: string;
}

function LoadingShell({ reportId }: PrintReportTemplateProps) {
  return (
    <main
      data-print-state={PRINT_STATE.loading}
      style={SHELL_STYLE}
      aria-busy="true"
    >
      <p style={{ color: TEXT_SECONDARY }}>Loading report {reportId} …</p>
    </main>
  );
}

function ErrorShell({ reportId }: PrintReportTemplateProps) {
  return (
    <main data-print-state={PRINT_STATE.error} style={SHELL_STYLE} role="alert">
      <h1 style={{ margin: "0 0 8px", fontSize: "16px", color: "#c82014" }}>
        Report could not be rendered
      </h1>
      <p style={{ color: TEXT_SECONDARY }}>
        Report {reportId} failed to load and cannot be exported.
      </p>
    </main>
  );
}

function PrintReportHeader({
  periodLabel,
  submissionSummary,
}: {
  readonly periodLabel: string;
  readonly submissionSummary: string;
}) {
  return (
    <header
      style={{
        textAlign: "center",
        marginBottom: "20px",
        paddingBottom: "12px",
        borderBottom: "3px solid #006241",
      }}
    >
      <h1
        style={{
          margin: "0 0 4px",
          fontSize: "20px",
          fontWeight: 600,
          color: "#006241",
          letterSpacing: "-0.16px",
        }}
      >
        Software Development — Status Report
      </h1>
      <p style={{ margin: 0, fontSize: "13px", color: TEXT_SECONDARY }}>
        {periodLabel} &middot; {submissionSummary}
      </p>
    </header>
  );
}

function PrintProductReports({
  view,
}: {
  readonly view: MapWeeklyReportResult;
}) {
  return (
    <>
      <div className="page-break-before" />
      <section>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: "15px",
            fontWeight: 600,
            color: "#006241",
          }}
        >
          Product Reports
        </h2>
        {view.products.map((report) => (
          <PrintLeadSection key={report.id} report={report} />
        ))}
      </section>
    </>
  );
}

function PrintPortfolioOverview({
  view,
}: {
  readonly view: MapWeeklyReportResult;
}) {
  return (
    <section style={{ marginBottom: "20px" }}>
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: "15px",
          fontWeight: 600,
          color: "#006241",
        }}
      >
        Portfolio Overview
      </h2>
      <PrintPortfolioTable products={view.portfolio} />
    </section>
  );
}

function PrintReportFooter({
  generatedAt,
  reportId,
}: {
  readonly generatedAt: string;
  readonly reportId: string;
}) {
  return (
    <footer
      style={{
        marginTop: "24px",
        paddingTop: "8px",
        borderTop: BORDER_LIGHT,
        textAlign: "center",
        fontSize: "10px",
        color: "rgba(0,0,0,0.38)",
      }}
    >
      Generated {generatedAt} — Report ID: {reportId}
    </footer>
  );
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
