import type {
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../report-sections";
import {
  Gutter,
  Rail,
  RankMark,
  StatusBadge,
} from "./accordion-row-primitives";
import { CSS, itemRailTone, ROW_GRID } from "./accordion-tokens";

export function ItemRow({ item }: { readonly item: WeeklyReportItem }) {
  return (
    <div className={ROW_GRID} data-accordion-row="item">
      <span className="flex min-h-[18px] justify-center pt-px">
        {item.priorityRank != null ? (
          <RankMark rank={item.priorityRank} />
        ) : null}
      </span>
      <Rail tone={itemRailTone(item.status)} />
      <Gutter stage={item.stage} owner={item.owner} />
      <span className="pt-px text-[14.5px] leading-normal text-[var(--color-foreground)]">
        {item.text}
      </span>
      <StatusBadge status={item.status} />
    </div>
  );
}

export function RiskRow({ risk }: { readonly risk: WeeklyReportRisk }) {
  const tone =
    risk.severity === "blocked" ? CSS.destructive : CSS.statusAtRiskBorder;
  return (
    <div className={ROW_GRID} data-accordion-row="risk">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone={tone} />
      <Gutter stage={risk.stage} owner={risk.owner} />
      <span className="pt-px">
        <div className="text-[14.5px] leading-snug text-[var(--color-foreground)]">
          {risk.problem}
        </div>
        {risk.impact || risk.mitigation ? (
          <div className="mt-1.5 grid grid-cols-[84px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-1">
            {risk.impact ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--color-destructive)]">
                  Impact
                </span>
                <span className="text-[13px] leading-snug">{risk.impact}</span>
              </>
            ) : null}
            {risk.mitigation ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
                  Mitigation
                </span>
                <span className="text-[13px] leading-snug text-[var(--color-starbucks-accent)]">
                  {risk.mitigation}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </span>
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
  const tone = isBlocked ? CSS.destructive : CSS.statusAtRiskBorder;
  return (
    <div className={ROW_GRID} data-accordion-row="escalation">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone={tone} />
      <Gutter stage="Flagged" owner="" />
      <span className="pt-px text-[14.5px] leading-snug text-[var(--color-foreground)]">
        {description}
      </span>
      <span className="flex justify-end pt-px">
        <span
          className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
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
          {isBlocked ? "Blocked" : "At Risk"}
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
      <span className="pt-px text-[14.5px] leading-normal text-[var(--color-foreground)]">
        {decision.text}
      </span>
      <span aria-hidden="true" />
    </div>
  );
}
