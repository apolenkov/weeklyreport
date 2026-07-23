import type { MapWeeklyReportResult } from "../../../features/report-sections/model/weekly-report";
import { PrintLeadSection } from "./print-lead-section";
import { PrintPortfolioTable } from "./print-portfolio-table";
import {
  BORDER_LIGHT,
  printStatusColor,
  TEXT_SECONDARY,
} from "./print-report-theme";

export function PrintReportHeader({
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
        borderBottom: `3px solid ${printStatusColor("on-track")}`,
      }}
    >
      <h1
        style={{
          margin: "0 0 4px",
          fontSize: "20px",
          fontWeight: 600,
          color: printStatusColor("on-track"),
          letterSpacing: "-0.16px",
        }}
      >
        Core Development — Status Report
      </h1>
      <p style={{ margin: 0, fontSize: "13px", color: TEXT_SECONDARY }}>
        {periodLabel} &middot; {submissionSummary}
      </p>
    </header>
  );
}

export function PrintProductReports({
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
            color: printStatusColor("on-track"),
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

export function PrintPortfolioOverview({
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
          color: printStatusColor("on-track"),
        }}
      >
        Portfolio Overview
      </h2>
      <PrintPortfolioTable products={view.portfolio} />
    </section>
  );
}

export function PrintReportFooter({
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
