import type { CSSProperties } from "react";

import { statusLabel } from "../../../shared/lib/status/status-presentation";
import type { PrintActivityReport } from "./print-activity-projection";
import {
  CurrentWeekRecords,
  DecisionRecords,
  NextWeekRecords,
  RiskRecords,
} from "./print-lead-records";
import {
  BRAND_DARK_SURFACE,
  ON_BRAND_TEXT,
  printStatusColor,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./print-report-theme";

const HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
  paddingBottom: "4px",
  borderBottom: `2px solid ${printStatusColor("on-track")}`,
};

export function PrintActivitySection({
  report,
}: {
  readonly report: PrintActivityReport;
}) {
  const contributorNames = report.contributors
    .map((contributor) => contributor.name)
    .join(" · ");
  return (
    <section style={{ marginBottom: "16px" }}>
      <div className="print-entity-header" style={HEADER_STYLE}>
        <h3
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: printStatusColor("on-track"),
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
            backgroundColor:
              report.status === "empty"
                ? BRAND_DARK_SURFACE
                : printStatusColor(report.status),
          }}
        >
          {statusLabel(report.status, "print")}
        </span>
        <span
          style={{
            minWidth: 0,
            fontSize: "11px",
            color: TEXT_SECONDARY,
            marginLeft: "auto",
            overflowWrap: "anywhere",
            textAlign: "right",
          }}
        >
          {contributorNames}
        </span>
      </div>
      {report.presentations.map((presentation) => (
        <div
          key={presentation.reportSectionId}
          style={{
            marginBottom: "8px",
            fontSize: "11px",
            overflowWrap: "anywhere",
          }}
        >
          <div style={{ color: TEXT_PRIMARY }}>
            <strong>{presentation.title}</strong>
            <span style={{ color: TEXT_SECONDARY }}>
              {" · "}
              {presentation.authorName}
            </span>
          </div>
          {presentation.note ? (
            <div style={{ color: TEXT_SECONDARY }}>{presentation.note}</div>
          ) : null}
        </div>
      ))}
      <CurrentWeekRecords report={report} />
      <NextWeekRecords report={report} />
      <RiskRecords report={report} />
      <DecisionRecords report={report} />
    </section>
  );
}
