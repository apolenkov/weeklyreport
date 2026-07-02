"use client";

import type { SectionActivity } from "@customreport/shared";

/**
 * The minimal section slice the strip reads. `activities` is optional here
 * (unlike the parsed read model) so pre-activity snapshot shapes and legacy
 * fixtures render as "no activities" instead of crashing.
 */
interface ActivitySectionSlice {
  readonly authorId: string;
  readonly authorName: string;
  readonly activities?: readonly SectionActivity[];
}

type ActivityTone = "on-track" | "at-risk" | "blocked" | "empty";

interface ActivityRow {
  readonly key: string;
  readonly activityName: string;
  readonly authorName: string;
  readonly tone: ActivityTone;
  readonly note: string | null;
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

function toTone(status: "green" | "yellow" | "red" | null): ActivityTone {
  if (status === "red") return "blocked";
  if (status === "yellow") return "at-risk";
  if (status === "green") return "on-track";
  return "empty";
}

/**
 * Flatten every section's activity statuses into display rows, one per
 * (activity, author) — several leads can report the same activity, each row is
 * that author's own status. Read through the section author, like the rest of
 * the report body; no separate group filter.
 */
function buildActivityRows(
  sections: readonly ActivitySectionSlice[],
): ActivityRow[] {
  return sections
    .flatMap((section) =>
      (section.activities ?? []).map((activity) => ({
        key: `${activity.activityId}::${section.authorId}`,
        activityName: activity.activityName,
        authorName: section.authorName,
        tone: toTone(activity.status),
        note: activity.note ?? null,
      })),
    )
    .sort(
      (a, b) =>
        a.activityName.localeCompare(b.activityName, "ru") ||
        a.authorName.localeCompare(b.authorName, "ru"),
    );
}

/**
 * Compact "Project Activities" band on the assembled weekly report — the
 * stage-less units beside products. Display-only: activity status never feeds
 * portfolio totals, escalations, or product health. Self-suppresses when no
 * section carries an activity.
 */
export function ActivityStatusStrip({
  sections,
}: {
  readonly sections: readonly ActivitySectionSlice[];
}) {
  const rows = buildActivityRows(sections);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Project activities"
      data-testid="activity-status-strip"
      className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
        Project Activities
      </h3>
      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className={[
                "inline-block h-2 w-2 shrink-0 rounded-full",
                TONE_DOT_CLASS[row.tone],
              ].join(" ")}
            />
            <span className="font-medium text-[var(--color-foreground)]">
              {row.activityName}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-muted-foreground)]">
              {TONE_LABEL[row.tone]}
            </span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {row.authorName}
            </span>
            {row.note ? (
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-muted-foreground)]">
                {row.note}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
