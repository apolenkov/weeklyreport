import type {
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../../report-sections";
import {
  DecisionRecordContent,
  ItemRecordContent,
  RiskRecordContent,
} from "../../../report-sections";
import {
  Gutter,
  Rail,
  RankMark,
  StatusBadge,
} from "./accordion-row-primitives";
import {
  CSS,
  itemRailTone,
  ROW_GRID,
  severityRailTone,
} from "./accordion-tokens";

export function ItemRow({ item }: { readonly item: WeeklyReportItem }) {
  return (
    <div className={ROW_GRID} data-accordion-row="item">
      <span className="flex min-h-[18px] justify-center pt-px">
        {item.priorityRank != null ? (
          <RankMark rank={item.priorityRank} />
        ) : null}
      </span>
      <Rail tone={item.resolution ? CSS.muted : itemRailTone(item.status)} />
      <Gutter stage={item.stage} owner={item.owner} />
      <ItemRecordContent item={item} />
      {item.resolution ? (
        <span aria-hidden="true" />
      ) : (
        <StatusBadge status={item.status} />
      )}
    </div>
  );
}

export function RiskRow({ risk }: { readonly risk: WeeklyReportRisk }) {
  const tone = severityRailTone(risk.severity);
  return (
    <div className={ROW_GRID} data-accordion-row="risk">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone={tone} />
      <Gutter stage={risk.stage} owner={risk.owner} />
      <RiskRecordContent risk={risk} />
      <span aria-hidden="true" />
    </div>
  );
}

// Escalations fold into Risks & Blockers instead of a separate banner.
export function EscalationRow({
  description,
  severity,
}: {
  readonly description: string;
  readonly severity: "blocked" | "at-risk";
}) {
  const isBlocked = severity === "blocked";
  const tone = severityRailTone(severity);
  return (
    <div className={ROW_GRID} data-accordion-row="escalation">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone={tone} />
      <Gutter stage="Flagged" owner="" />
      <span className="pt-px text-[14.5px] leading-snug text-[var(--color-foreground)]">
        {description}
      </span>
      <span className="flex justify-start pt-px sm:justify-end">
        <span
          className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold"
          style={
            isBlocked
              ? {
                  background: CSS.statusBlockedBg,
                  color: CSS.destructive,
                }
              : {
                  background: "var(--color-surface-muted)",
                  color: CSS.statusAtRiskFg,
                }
          }
        >
          {isBlocked ? "Blocked" : "At risk"}
        </span>
      </span>
    </div>
  );
}

export function DecisionRow({
  decision,
}: {
  readonly decision: WeeklyReportDecision;
}) {
  return (
    <div className={ROW_GRID} data-accordion-row="decision">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone="var(--color-decisions-accent)" />
      <Gutter stage="Decision" owner={decision.owner} />
      <DecisionRecordContent decision={decision} />
      <span aria-hidden="true" />
    </div>
  );
}
