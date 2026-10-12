import type { MapWeeklyReportResult } from "../../../features/report-sections";
import type { PrintActivityReport } from "./print-activity-projection";
import { PrintActivitySection } from "./print-activity-section";
import { PrintPortfolioTable } from "./print-portfolio-table";
import { PrintProductSection } from "./print-product-section";
import {
  BORDER_LIGHT,
  printStatusColor,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
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
  if (view.products.length === 0) return null;
  return (
    <>
      <div className="page-break-before" />
      <section>
        <h2
          className="print-section-heading"
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
          <PrintProductSection key={report.id} report={report} />
        ))}
      </section>
    </>
  );
}

export function PrintActivityReports({
  reports,
}: {
  readonly reports: readonly PrintActivityReport[];
}) {
  if (reports.length === 0) return null;
  return (
    <section>
      <h2
        className="print-section-heading"
        style={{
          margin: "0 0 12px",
          fontSize: "15px",
          fontWeight: 600,
          color: printStatusColor("on-track"),
        }}
      >
        Activity Reports
      </h2>
      {reports.map((report) => (
        <PrintActivitySection key={report.id} report={report} />
      ))}
    </section>
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
        className="print-section-heading"
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
        color: TEXT_TERTIARY,
      }}
    >
      Generated {generatedAt} — Report ID: {reportId}
    </footer>
  );
}
