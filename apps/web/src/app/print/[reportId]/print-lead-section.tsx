import type { CSSProperties } from "react";

import type { WeeklyProductReport } from "../../../features/report-sections/model/weekly-report-types";
import { statusLabel } from "../../../lib/status-presentation";
import {
  CurrentWeekRecords,
  DecisionRecords,
  NextWeekRecords,
  PriorityRecords,
  RiskRecords,
} from "./print-lead-records";
import {
  ATTENTION_BG,
  BRAND_DARK_SURFACE,
  ON_BRAND_TEXT,
  printStatusColor,
  TEXT_SECONDARY,
} from "./print-report-theme";

interface PrintLeadSectionProps {
  readonly report: WeeklyProductReport;
}

// Brand green for lead chrome (same as printStatusColor("on-track")).
const LEAD_BRAND_GREEN = printStatusColor("on-track");

const LEAD_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
  paddingBottom: "4px",
  borderBottom: `2px solid ${LEAD_BRAND_GREEN}`,
};
const LEAD_INITIALS_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  backgroundColor: BRAND_DARK_SURFACE,
  color: ON_BRAND_TEXT,
  fontSize: "11px",
  fontWeight: 600,
};

function PrintLeadHeader({ report }: PrintLeadSectionProps) {
  return (
    <div style={LEAD_HEADER_STYLE}>
      <span style={LEAD_INITIALS_STYLE}>{report.initials}</span>
      <h3
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 600,
          color: LEAD_BRAND_GREEN,
        }}
      >
        {report.name}
      </h3>
      <span
        style={{
          display: "inline-block",
          padding: "1px 8px",
          borderRadius: "50px",
          fontSize: "10px",
          fontWeight: 600,
          color: ON_BRAND_TEXT,
          backgroundColor: printStatusColor(report.status),
        }}
      >
        {statusLabel(report.status, "print")}
      </span>
      <span
        style={{ fontSize: "11px", color: TEXT_SECONDARY, marginLeft: "auto" }}
      >
        {report.leads}
      </span>
    </div>
  );
}

function PrintNeedsAttention({ report }: PrintLeadSectionProps) {
  if (!report.needsAttention) return null;
  // The projection guarantees severity alongside the text (ProductAttention);
  // a missing severity here is a projection bug the type system now rejects.
  return (
    <div
      style={{
        padding: "6px 10px",
        marginBottom: "8px",
        borderLeft: `3px solid ${printStatusColor(report.needsAttentionSeverity)}`,
        backgroundColor: ATTENTION_BG,
        fontSize: "11px",
      }}
    >
      {report.needsAttention}
    </div>
  );
}

export function PrintLeadSection({ report }: PrintLeadSectionProps) {
  return (
    <section style={{ marginBottom: "16px", pageBreakInside: "avoid" }}>
      <PrintLeadHeader report={report} />
      <PrintNeedsAttention report={report} />
      <CurrentWeekRecords report={report} />
      <NextWeekRecords report={report} />
      <RiskRecords report={report} />
      <DecisionRecords report={report} />
      <PriorityRecords report={report} />
    </section>
  );
}
