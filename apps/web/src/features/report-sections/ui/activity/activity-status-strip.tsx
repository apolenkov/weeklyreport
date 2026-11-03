"use client";

import { shortNameFromName } from "@weeklyreport/shared";

import {
  statusDotClassName,
  statusLabel,
} from "../../../../shared/lib/status/status-presentation";
import type { AccordionReviewContext } from "../../../review/index";
import {
  type ActivitySectionSlice,
  buildHeadActivityRecords,
  type HeadActivityRecords,
} from "../../model/head-activity-records";
import {
  ActivityRecordDetails,
  type ActivityReviewRow,
} from "./activity-record-details";

function ActivityBodyCard({
  card,
  review,
  Row,
}: {
  readonly card: HeadActivityRecords;
  readonly review: AccordionReviewContext | undefined;
  readonly Row: ActivityReviewRow | undefined;
}) {
  const linkedNames = card.linkedProducts.join(", ");
  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-card)]/70 p-3">
      <div
        className={
          card.tone === null
            ? "min-w-0"
            : "grid grid-cols-[auto_minmax(0,1fr)] gap-x-2"
        }
      >
        {card.tone !== null ? (
          <span
            aria-hidden="true"
            className={[
              "mt-[0.45rem] h-2 w-2 shrink-0 self-start rounded-full",
              statusDotClassName(card.tone),
            ].join(" ")}
          />
        ) : null}
        <div className="min-w-0">
          <span className="font-medium text-[var(--color-foreground)]">
            {card.activityName}
          </span>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--color-muted-foreground)]">
            {card.tone !== null ? (
              <span className="font-semibold">
                {statusLabel(card.tone, "screen")}
              </span>
            ) : null}
            <span className="[overflow-wrap:anywhere]">
              {card.tone === null
                ? card.authorName
                : shortNameFromName(card.authorName)}
            </span>
          </p>
          {linkedNames ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Products: {linkedNames}
            </p>
          ) : null}
        </div>
      </div>
      {card.note ? (
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {card.note}
        </p>
      ) : null}
      <ActivityRecordDetails card={card} review={review} Row={Row} />
    </li>
  );
}

export function ActivityStatusStrip({
  sections,
  review,
  Row,
}: {
  readonly sections: readonly ActivitySectionSlice[];
  readonly review?: AccordionReviewContext | undefined;
  readonly Row?: ActivityReviewRow | undefined;
}) {
  const cards = buildHeadActivityRecords(sections);
  if (cards.length === 0) return null;

  return (
    <section
      aria-label="Project activities"
      data-testid="activity-status-strip"
      className="rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--card-surface-gradient)] p-4 shadow-[0_1px_2px_var(--color-border-subtle)]"
    >
      <h2 className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
        Project Activities
      </h2>
      <ul className="mt-3 space-y-2">
        {cards.map((card) => (
          <ActivityBodyCard
            key={card.key}
            card={card}
            review={review}
            Row={Row}
          />
        ))}
      </ul>
    </section>
  );
}
