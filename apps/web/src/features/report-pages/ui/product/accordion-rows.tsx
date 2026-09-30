import type {
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../../report-sections";
import {
  Gutter,
  Rail,
  RankMark,
  StatusBadge,
} from "./accordion-row-primitives";
import { CSS, itemRailTone, ROW_GRID } from "./accordion-tokens";

const OUTCOME_LABELS = {
  done: "Completed",
  continue: "Continued",
  plan_next: "Planned next step",
  promote: "Promoted next step",
  restore: "Restored plan",
  wont_do: "Marked Won't do",
} as const;

function auditTimestamp(occurredAt: string): string {
  return occurredAt.replace("T", " ").replace(/:\d{2}(?:\.\d+)?Z$/, " UTC");
}

function ItemOutcomeDetails({ item }: { readonly item: WeeklyReportItem }) {
  const events = item.outcomeHistory ?? [];
  const resolution = item.resolution;
  if (events.length === 0 && resolution == null) return null;
  return (
    <details className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
      <summary className="cursor-pointer font-medium text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
        Outcome history
      </summary>
      <ul className="mt-1 space-y-1">
        {events.length > 0 ? (
          events.map((event) => (
            <li key={event.id} className="[overflow-wrap:anywhere]">
              {OUTCOME_LABELS[event.outcome]} by {event.actorName} ·{" "}
              {auditTimestamp(event.occurredAt)}
              {event.reason ? ` · ${event.reason}` : ""}
            </li>
          ))
        ) : resolution ? (
          <li className="[overflow-wrap:anywhere]">
            Marked Won&apos;t do by {resolution.actorName} ·{" "}
            {auditTimestamp(resolution.occurredAt)}
          </li>
        ) : null}
      </ul>
    </details>
  );
}

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
      <div className="min-w-0 pt-px text-[14.5px] leading-normal text-[var(--color-foreground)]">
        <p className="[overflow-wrap:anywhere]">{item.text}</p>
        {item.nextStepText ? (
          <p className="mt-1 text-[13px] text-[var(--color-muted-foreground)] [overflow-wrap:anywhere]">
            Next commitment: {item.nextStepText}
          </p>
        ) : null}
        {item.resolution ? (
          <p className="mt-1 text-[13px] text-[var(--color-muted-foreground)] [overflow-wrap:anywhere]">
            Won&apos;t do: {item.resolution.reason}
          </p>
        ) : null}
        <ItemOutcomeDetails item={item} />
      </div>
      {item.resolution ? (
        <span aria-hidden="true" />
      ) : (
        <StatusBadge status={item.status} />
      )}
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
      <div className="min-w-0 pt-px">
        <div className="text-[14.5px] leading-snug text-[var(--color-foreground)]">
          {risk.problem}
        </div>
        {risk.impact || risk.mitigation ? (
          <div className="mt-1.5 grid grid-cols-1 items-baseline gap-x-2.5 gap-y-1 sm:grid-cols-[84px_minmax(0,1fr)]">
            {risk.impact ? (
              <>
                <span className="text-xs font-bold text-[var(--color-destructive)]">
                  Impact
                </span>
                <span className="text-[13px] leading-snug">{risk.impact}</span>
              </>
            ) : null}
            {risk.mitigation ? (
              <>
                <span className="text-xs font-bold text-[var(--color-muted-foreground)]">
                  Mitigation
                </span>
                <span className="text-[13px] leading-snug text-[var(--color-starbucks-accent)]">
                  {risk.mitigation}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
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
      <span className="pt-px text-[14.5px] leading-normal text-[var(--color-foreground)]">
        {decision.text}
      </span>
      <span aria-hidden="true" />
    </div>
  );
}
