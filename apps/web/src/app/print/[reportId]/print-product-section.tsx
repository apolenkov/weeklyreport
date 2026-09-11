import type { CSSProperties } from "react";

import type { WeeklyProductReport } from "../../../features/report-sections";
import { statusLabel } from "../../../shared/lib/status/status-presentation";
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

interface PrintProductSectionProps {
  readonly report: WeeklyProductReport;
}

// Brand green for product chrome (same as printStatusColor("on-track")).
const PRODUCT_BRAND_GREEN = printStatusColor("on-track");

const PRODUCT_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
  paddingBottom: "4px",
  borderBottom: `2px solid ${PRODUCT_BRAND_GREEN}`,
};
const PRODUCT_INITIALS_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  backgroundColor: BRAND_DARK_SURFACE,
  color: ON_BRAND_TEXT,
  fontSize: "11px",
  fontWeight: 600,
};

function PrintProductHeader({ report }: PrintProductSectionProps) {
  return (
    <div className="print-entity-header" style={PRODUCT_HEADER_STYLE}>
      <span style={PRODUCT_INITIALS_STYLE}>{report.initials}</span>
      <h3
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 600,
          color: PRODUCT_BRAND_GREEN,
          minWidth: 0,
          overflowWrap: "anywhere",
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
          flexShrink: 0,
          whiteSpace: "nowrap",
          color: ON_BRAND_TEXT,
          backgroundColor: printStatusColor(report.status),
        }}
      >
        {statusLabel(report.status, "print")}
      </span>
      <span
        style={{
          minWidth: 0,
          marginLeft: "auto",
          overflowWrap: "anywhere",
          textAlign: "right",
          fontSize: "11px",
          color: TEXT_SECONDARY,
        }}
      >
        {report.leads}
      </span>
    </div>
  );
}

function PrintNeedsAttention({ report }: PrintProductSectionProps) {
  if (!report.needsAttention) return null;
  // ProductAttention carries severity alongside its explanatory text; a
  // missing severity is invalid at the projection boundary.
  return (
    <div
      style={{
        padding: "6px 10px",
        marginBottom: "8px",
        borderLeft: `3px solid ${printStatusColor(report.needsAttentionSeverity)}`,
        backgroundColor: ATTENTION_BG,
        fontSize: "11px",
        overflowWrap: "anywhere",
      }}
    >
      {report.needsAttention}
    </div>
  );
}

export function PrintProductSection({ report }: PrintProductSectionProps) {
  return (
    <section style={{ marginBottom: "16px" }}>
      <PrintProductHeader report={report} />
      <PrintNeedsAttention report={report} />
      <CurrentWeekRecords report={report} />
      <NextWeekRecords report={report} />
      <RiskRecords report={report} />
      <DecisionRecords report={report} />
      <PriorityRecords report={report} />
    </section>
  );
}
