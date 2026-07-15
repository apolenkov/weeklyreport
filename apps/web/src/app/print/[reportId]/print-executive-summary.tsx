import type { CSSProperties, ReactNode } from "react";

import { BORDER_LIGHT, TEXT_SECONDARY } from "./print-report-theme";

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
          color: "#006241",
        }}
      >
        Executive Summary
      </h2>
      <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
        <SummaryCard color="#006241" label="Submitted">
          {submitted}/{total}
        </SummaryCard>
        <SummaryCard color="#c82014" label="Blocked">
          {blockedCount}
        </SummaryCard>
        <SummaryCard color="#daa520" label="At Risk">
          {atRiskCount}
        </SummaryCard>
        <SummaryCard color="#3730a3" label="Decisions">
          {decisionCount}
        </SummaryCard>
      </div>
    </section>
  );
}
