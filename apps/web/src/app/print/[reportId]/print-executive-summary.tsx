import type { RecordOmissionSummary } from "@weeklyreport/shared";
import type { CSSProperties, ReactNode } from "react";

import { recordOmissionNoticeText } from "../../../shared/lib/format/record-omission-text";
import {
  ATTENTION_BG,
  BORDER_LIGHT,
  DECISION_ACCENT,
  printStatusColor,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "./print-report-theme";

interface PrintExecutiveSummaryProps {
  readonly submitted: number;
  readonly total: number;
  readonly blockedCount: number;
  readonly atRiskCount: number;
  readonly decisionCount: number;
}

const CARD_STYLE: CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  border: BORDER_LIGHT,
  borderRadius: "8px",
  textAlign: "center",
};
const SUBMITTED_COLOR = printStatusColor("on-track");
const BLOCKED_COLOR = printStatusColor("blocked");
const AT_RISK_COLOR = printStatusColor("at-risk");

function SummaryCard({
  color,
  label,
  children,
}: {
  readonly color: string;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ fontSize: "20px", fontWeight: 600, color }}>{children}</div>
      <div style={{ color: TEXT_SECONDARY }}>{label}</div>
    </div>
  );
}

export function PrintExecutiveSummary({
  submitted,
  total,
  blockedCount,
  atRiskCount,
  decisionCount,
}: PrintExecutiveSummaryProps) {
  return (
    <section style={{ marginBottom: "20px" }}>
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: "15px",
          fontWeight: 600,
          color: SUBMITTED_COLOR,
        }}
      >
        Executive Summary
      </h2>
      <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
        <SummaryCard color={SUBMITTED_COLOR} label="Submitted">
          {submitted}/{total}
        </SummaryCard>
        <SummaryCard
          color={BLOCKED_COLOR}
          label="Blocked products / activities"
        >
          {blockedCount}
        </SummaryCard>
        <SummaryCard
          color={AT_RISK_COLOR}
          label="At-risk products / activities"
        >
          {atRiskCount}
        </SummaryCard>
        <SummaryCard color={DECISION_ACCENT} label="Decisions">
          {decisionCount}
        </SummaryCard>
      </div>
    </section>
  );
}

/**
 * Says which unfinished risks and decisions the printed publication leaves
 * out, from the totals frozen with it (openspec: pdf-export-integrity). Kept
 * apart from the submitted count so neither reads as the other.
 */
export function PrintRecordOmissionNotice({
  summary,
}: {
  readonly summary: RecordOmissionSummary;
}) {
  const text = recordOmissionNoticeText(summary);
  if (text === null) return null;
  return (
    <p
      role="note"
      aria-label="Records not shown"
      style={{
        margin: "0 0 20px",
        padding: "8px 12px",
        border: BORDER_LIGHT,
        borderRadius: "8px",
        background: ATTENTION_BG,
        color: TEXT_PRIMARY,
        fontSize: "11px",
      }}
    >
      {text}
    </p>
  );
}
