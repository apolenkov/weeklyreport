"use client";

import type {
  CanonicalStatus,
  ReportSectionReadModel,
  SectionActivity,
  TrafficLightStatus,
} from "@customreport/shared";

// `linkedProducts` carries a schema default, but legacy fixtures and frozen
// pre-activity snapshots may omit it, so tolerate its absence at the type level.
type StripActivity = Omit<SectionActivity, "linkedProducts"> & {
  readonly linkedProducts?: SectionActivity["linkedProducts"];
};

// Optional fields so pre-activity snapshots and legacy fixtures render empty
// instead of crashing.
interface ActivitySectionSlice {
  readonly authorId: string;
  readonly authorName: string;
  readonly activities?: readonly StripActivity[];
  readonly items?: ReportSectionReadModel["items"];
  readonly risks?: ReportSectionReadModel["risks"];
  readonly decisions?: ReportSectionReadModel["decisions"];
}

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

const TONE_LABEL: Record<ActivityTone, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  blocked: "Blocked",
  empty: "No status",
};

const TONE_DOT_CLASS: Record<ActivityTone, string> = {
  "on-track": "bg-[var(--color-primary)]",
  "at-risk": "bg-[var(--color-status-dot-at-risk)]",
  blocked: "bg-[var(--color-destructive)]",
  empty: "bg-[var(--color-muted-foreground)] opacity-50",
};

function toTone(status: TrafficLightStatus | null): ActivityTone {
  if (status === "red") return "blocked";
  if (status === "yellow") return "at-risk";
  if (status === "green") return "on-track";
  return "empty";
}

function toActivityCard(
  section: ActivitySectionSlice,
  activity: StripActivity,
): ActivityCardModel {
  const owns = (parentId: string | null | undefined): boolean =>
    parentId === activity.activityId;
  const items = (section.items ?? []).filter((i) => owns(i.activityId));
  return {
    key: `${activity.activityId}::${section.authorId}`,
    activityName: activity.activityName,
    authorName: section.authorName,
    // Render the risk/blocker-derived floor, falling back to the stored status.
    // `derivedStatus`/`linkedProducts` carry schema defaults, but legacy/partial
    // fixtures and frozen snapshots may omit them — tolerate that here.
    tone: toTone(activity.derivedStatus ?? activity.status),
    note: activity.note ?? null,
    linkedProducts: (activity.linkedProducts ?? []).map((p) => p.productName),
    currentItems: items.filter((i) => i.type === "current").map((i) => i.text),
    nextItems: items.filter((i) => i.type === "next").map((i) => i.text),
    risks: (section.risks ?? [])
      .filter((r) => owns(r.activityId))
      .map((r) => r.risk),
    decisions: (section.decisions ?? [])
      .filter((d) => owns(d.activityId))
      .map((d) => d.text),
  };
}

function buildActivityCards(
  sections: readonly ActivitySectionSlice[],
): ActivityCardModel[] {
  return sections
    .flatMap((section) =>
      (section.activities ?? []).map((activity) =>
        toActivityCard(section, activity),
      ),
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
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
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
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className={[
            "inline-block h-2 w-2 shrink-0 rounded-full",
            TONE_DOT_CLASS[card.tone],
          ].join(" ")}
        />
        <span className="font-medium text-[var(--color-foreground)]">
          {card.activityName}
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted-foreground)]">
          {TONE_LABEL[card.tone]}
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {card.authorName}
        </span>
        {linkedNames ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            · Products: {linkedNames}
          </span>
        ) : null}
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
      className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
        Project Activities
      </h3>
      <ul className="mt-3 space-y-2">
        {cards.map((card) => (
          <ActivityBodyCard key={card.key} card={card} />
        ))}
      </ul>
    </section>
  );
}
