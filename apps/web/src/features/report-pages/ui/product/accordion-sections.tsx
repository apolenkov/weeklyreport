import { pluralize } from "../../../../shared/lib/format/pluralize";
import type {
  WeeklyProductReport,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../../report-sections";
import { sortByPriorityRank } from "../../../report-sections";
import { type AccordionReviewContext, ReviewedRow } from "../../../review";
import { SectionHeader } from "./accordion-row-primitives";
import { DecisionRow, EscalationRow, ItemRow, RiskRow } from "./accordion-rows";
import { SECTION_DIVIDER } from "./accordion-tokens";

function ItemsSection({
  title,
  items,
  review,
}: {
  readonly title: string;
  readonly items: readonly WeeklyReportItem[];
  readonly review: AccordionReviewContext | undefined;
}) {
  return (
    <div className={SECTION_DIVIDER}>
      <SectionHeader
        title={title}
        count={`${items.length} ${pluralize(items.length, "item", "items")}`}
      />
      <div className="space-y-px">
        {items.map((item) => (
          <ReviewedRow
            key={item.id}
            review={review}
            anchor={{ itemId: item.id }}
            record={item}
          >
            <ItemRow item={item} />
          </ReviewedRow>
        ))}
      </div>
    </div>
  );
}

function RisksSection({
  risks,
  needsAttention,
  needsAttentionSeverity,
  showNeedsAttention,
  review,
}: {
  readonly risks: readonly WeeklyReportRisk[];
  readonly needsAttention: string | undefined;
  readonly needsAttentionSeverity: "blocked" | "at-risk" | undefined;
  readonly showNeedsAttention: boolean;
  readonly review: AccordionReviewContext | undefined;
}) {
  return (
    <div className={SECTION_DIVIDER}>
      <SectionHeader
        title="Risks & Blockers"
        count={`${risks.length + (showNeedsAttention ? 1 : 0)}`}
      />
      <div className="space-y-1">
        {showNeedsAttention && needsAttention ? (
          <EscalationRow
            description={needsAttention}
            severity={needsAttentionSeverity ?? "at-risk"}
          />
        ) : null}
        {risks.map((risk) => (
          <ReviewedRow
            key={risk.id}
            review={review}
            anchor={{ riskId: risk.id }}
            record={risk}
          >
            <RiskRow risk={risk} />
          </ReviewedRow>
        ))}
      </div>
    </div>
  );
}

function DecisionsSection({
  decisions,
  review,
}: {
  readonly decisions: readonly WeeklyReportDecision[];
  readonly review: AccordionReviewContext | undefined;
}) {
  return (
    <div className={SECTION_DIVIDER}>
      <SectionHeader title="Decisions" count={`${decisions.length}`} />
      <div className="space-y-px">
        {decisions.map((decision) => (
          <ReviewedRow
            key={decision.id}
            review={review}
            anchor={{ decisionId: decision.id }}
            record={decision}
          >
            <DecisionRow decision={decision} />
          </ReviewedRow>
        ))}
      </div>
    </div>
  );
}

export function AccordionSections({
  report,
  review,
  showNeedsAttention,
}: {
  readonly report: WeeklyProductReport;
  readonly review: AccordionReviewContext | undefined;
  readonly showNeedsAttention: boolean;
}) {
  return (
    <div className="space-y-5 border-t border-[var(--color-border-subtle)] px-5 pb-5 pt-4">
      {report.currentWeek.length > 0 && (
        <ItemsSection
          title="Current Week"
          items={sortByPriorityRank(report.currentWeek)}
          review={review}
        />
      )}
      {report.nextWeek.length > 0 && (
        <ItemsSection
          title="Next Week"
          items={sortByPriorityRank(report.nextWeek)}
          review={review}
        />
      )}
      {(report.risks.length > 0 || showNeedsAttention) && (
        <RisksSection
          risks={report.risks}
          needsAttention={report.needsAttention}
          needsAttentionSeverity={report.needsAttentionSeverity}
          showNeedsAttention={showNeedsAttention}
          review={review}
        />
      )}
      {report.decisions.length > 0 && (
        <DecisionsSection decisions={report.decisions} review={review} />
      )}
    </div>
  );
}
