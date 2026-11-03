"use client";

import {
  type ComponentProps,
  type ComponentType,
  useId,
  useState,
} from "react";

import { PAUSED_PROGRESS } from "../../../../shared/lib/status/item-progress-presentation";
import type { AccordionReviewContext } from "../../../review/index";
import type { ReviewedRow } from "../../../review/index";
import type { HeadActivityRecords } from "../../model/head-activity-records";
import { STATUS_BADGE } from "../../model/item-card-style";
import { deriveItemStatus } from "../../model/item-status";
import { sortByPriorityRank } from "../../model/priority/priority-sort";
import {
  DecisionRecordContent,
  ItemRecordContent,
  RiskRecordContent,
} from "../records/report-record-rows";

function recordId(record: { readonly id?: string | undefined }): string {
  if (!record.id) throw new Error("Report record is missing id");
  return record.id;
}

export type ActivityReviewRow = ComponentType<
  ComponentProps<typeof ReviewedRow>
>;
function ReadRow({ children }: ComponentProps<ActivityReviewRow>) {
  return children;
}

function ActivityItem({
  item,
  card,
  review,
  Row,
}: {
  readonly item: HeadActivityRecords["currentItems"][number];
  readonly card: HeadActivityRecords;
  readonly review: AccordionReviewContext | undefined;
  readonly Row: ActivityReviewRow;
}) {
  const status = deriveItemStatus(item);
  const projected = {
    id: recordId(item),
    text: item.text,
    stage: "",
    stageLead: "",
    owner: card.authorName,
    status,
    canReview: card.canReview,
    comments: item.comments ?? [],
    priorityRank: item.priorityRank ?? null,
    nextStepText: item.nextStepText ?? null,
    resolution: item.resolution ?? null,
    outcomeHistory: item.outcomeHistory ?? [],
  };
  return (
    <Row
      review={review}
      anchor={{ itemId: projected.id }}
      record={projected}
      subject={item.text}
    >
      <div className="min-w-0 space-y-1 py-2">
        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
          {item.priorityRank != null ? (
            <span>Priority {item.priorityRank}</span>
          ) : null}
          <span
            className={
              status === "paused" ? PAUSED_PROGRESS.className : undefined
            }
          >
            {status === "paused"
              ? PAUSED_PROGRESS.label
              : STATUS_BADGE[status].label}
          </span>
        </div>
        <ItemRecordContent item={projected} />
      </div>
    </Row>
  );
}

function ActivityRisk({
  risk,
  card,
  review,
  Row,
}: {
  readonly risk: HeadActivityRecords["risks"][number];
  readonly card: HeadActivityRecords;
  readonly review: AccordionReviewContext | undefined;
  readonly Row: ActivityReviewRow;
}) {
  const projected = {
    ...risk,
    id: recordId(risk),
    comments: risk.comments ?? [],
    badge: "",
    stage: "",
    owner: card.authorName,
    problem: risk.risk,
    text: risk.risk,
    canReview: card.canReview,
  };
  return (
    <Row
      review={review}
      anchor={{ riskId: projected.id }}
      record={projected}
      subject={risk.risk}
    >
      <div className="min-w-0 space-y-1 py-2">
        <span
          className={
            risk.severity === "blocked"
              ? "text-xs text-[var(--color-destructive)]"
              : "text-xs text-[var(--color-status-at-risk-fg)]"
          }
        >
          {risk.severity === "blocked" ? "Blocked" : "At risk"}
        </span>
        <RiskRecordContent risk={projected} />
      </div>
    </Row>
  );
}

export function ActivityRecordDetails({
  card,
  review,
  Row = ReadRow,
}: {
  readonly card: HeadActivityRecords;
  readonly review?: AccordionReviewContext | undefined;
  readonly Row?: ActivityReviewRow | undefined;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2 min-w-0">
      <button
        type="button"
        aria-label={`${card.activityName} details for ${card.authorName}`}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        className="min-h-[var(--touch-target-min)] max-w-full rounded-[var(--radius-sm)] text-left text-xs font-medium text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] [overflow-wrap:anywhere]"
      >
        Current {card.currentItems.length} · Next {card.nextItems.length} ·
        Risks &amp; Blockers {card.risks.length} · Decisions{" "}
        {card.decisions.length}
      </button>
      <div id={id} hidden={!expanded}>
        {expanded ? (
          <ActivityRecords card={card} review={review} Row={Row} />
        ) : null}
      </div>
    </div>
  );
}

function ActivityRecords({
  card,
  review,
  Row,
}: {
  readonly card: HeadActivityRecords;
  readonly review: AccordionReviewContext | undefined;
  readonly Row: ActivityReviewRow;
}) {
  return (
    <div className="space-y-3 border-t border-[var(--color-border-subtle)] pt-3">
      {(
        [
          ["Current", card.currentItems],
          ["Next", card.nextItems],
        ] as const
      ).map(([label, items]) =>
        items.length > 0 ? (
          <section key={label} aria-label={label}>
            <h3 className="text-sm font-semibold">{label}</h3>
            {sortByPriorityRank(items).map((item) => (
              <ActivityItem
                Row={Row}
                key={item.id}
                item={item}
                card={card}
                review={review}
              />
            ))}
          </section>
        ) : null,
      )}
      {card.risks.length > 0 ? (
        <section aria-label="Risks & Blockers">
          <h3 className="text-sm font-semibold">Risks &amp; Blockers</h3>
          {card.risks.map((risk) => (
            <ActivityRisk
              Row={Row}
              key={risk.id}
              risk={risk}
              card={card}
              review={review}
            />
          ))}
        </section>
      ) : null}
      {card.decisions.length > 0 ? (
        <section aria-label="Decisions">
          <h3 className="text-sm font-semibold">Decisions</h3>
          {card.decisions.map((decision) => (
            <Row
              key={recordId(decision)}
              review={review}
              anchor={{ decisionId: recordId(decision) }}
              record={{
                comments: decision.comments ?? [],
                canReview: card.canReview,
              }}
              subject={decision.text}
            >
              <DecisionRecordContent
                decision={{
                  id: recordId(decision),
                  text: decision.text,
                  owner: decision.owner,
                  badge: "",
                }}
              />
            </Row>
          ))}
        </section>
      ) : null}
    </div>
  );
}
