"use client";

import type {
  CanonicalStatus,
  ReportSectionReadModel,
  SectionActivity,
} from "@customreport/shared";
import {
  shortNameFromName,
  trafficLightToCanonical,
} from "@customreport/shared";

import { activityDisplayTitle } from "../../../../shared/lib/activity/activity-display";
import {
  statusDotClassName,
  statusLabel,
} from "../../../../shared/lib/status/status-presentation";

type ActivitySectionSlice = Pick<
  ReportSectionReadModel,
  "authorId" | "authorName" | "activities" | "items" | "risks" | "decisions"
>;

type ActivityTone = CanonicalStatus;

interface ActivityCardModel {
  readonly key: string;
  readonly activityName: string;
  readonly authorName: string;
  readonly tone: ActivityTone;
  readonly note: string | null;
  readonly linkedProducts: readonly string[];
  readonly currentItems: readonly string[];
  readonly nextItems: readonly string[];
  readonly risks: readonly string[];
  readonly decisions: readonly string[];
}

function toActivityCard(
  section: ActivitySectionSlice,
  activity: SectionActivity,
): ActivityCardModel {
  const owns = (parentId: string | null | undefined): boolean =>
    parentId === activity.activityId;
  const items = section.items.filter((i) => owns(i.activityId));
  return {
    key: `${activity.activityId}::${section.authorId}`,
    activityName: activityDisplayTitle(activity),
    authorName: section.authorName,
    // Render the risk/blocker-derived floor, falling back to the stored status.
    tone: trafficLightToCanonical(activity.derivedStatus ?? activity.status),
    note: activity.note ?? null,
    linkedProducts: activity.linkedProducts.map((p) => p.productName),
    currentItems: items.filter((i) => i.type === "current").map((i) => i.text),
    nextItems: items.filter((i) => i.type === "next").map((i) => i.text),
    risks: section.risks.filter((r) => owns(r.activityId)).map((r) => r.risk),
    decisions: section.decisions
      .filter((d) => owns(d.activityId))
      .map((d) => d.text),
  };
}

function buildActivityCards(
  sections: readonly ActivitySectionSlice[],
): ActivityCardModel[] {
  return sections
    .flatMap((section) =>
      section.activities.map((activity) => toActivityCard(section, activity)),
    )
    .sort(
      (a, b) =>
        a.activityName.localeCompare(b.activityName, "ru") ||
        a.authorName.localeCompare(b.authorName, "ru"),
    );
}

function RecordList({
  label,
  rows,
}: {
  readonly label: string;
  readonly rows: readonly string[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <ul className="mt-0.5 space-y-0.5">
        {rows.map((text, idx) => (
          <li
            key={`${label}-${String(idx)}`}
            className="text-sm text-[var(--color-foreground)]"
          >
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityBodyCard({ card }: { readonly card: ActivityCardModel }) {
  const linkedNames = card.linkedProducts.join(", ");
  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-card)]/70 p-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <span
          aria-hidden="true"
          className={[
            "mt-[0.45rem] h-2 w-2 shrink-0 self-start rounded-full",
            statusDotClassName(card.tone),
          ].join(" ")}
        />
        <div className="min-w-0">
          <span className="font-medium text-[var(--color-foreground)]">
            {card.activityName}
          </span>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--color-muted-foreground)]">
            <span className="font-semibold">
              {statusLabel(card.tone, "screen")}
            </span>
            <span>{shortNameFromName(card.authorName)}</span>
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
      <RecordList label="Current" rows={card.currentItems} />
      <RecordList label="Next" rows={card.nextItems} />
      <RecordList label="Risks & Blockers" rows={card.risks} />
      <RecordList label="Decisions" rows={card.decisions} />
    </li>
  );
}

export function ActivityStatusStrip({
  sections,
}: {
  readonly sections: readonly ActivitySectionSlice[];
}) {
  const cards = buildActivityCards(sections);
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
          <ActivityBodyCard key={card.key} card={card} />
        ))}
      </ul>
    </section>
  );
}
