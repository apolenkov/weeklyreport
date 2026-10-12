import type { StatusOverviewItem } from "../model/status-overview";
import type { PlanVerdict } from "../model/status-overview-verdict";

// Compact status glyphs for the Overview. Every icon is decorative: the
// adjacent accessible name keeps the meaning, and each status has its own
// shape so colour is never the only signal.
const ICON_CLASS = "h-5 w-5 shrink-0";

// Completion and active work use semantic hues; paused uses the alarm-family
// hue, while postponed, planned and wont-do states stay neutral.
const NEUTRAL_TONE = "text-[var(--color-muted-foreground)]";
const PROGRESS_TONE: Readonly<
  Record<StatusOverviewItem["workflowStatus"] | "wont_do", string>
> = {
  done: "text-[var(--color-chip-on-track-text)]",
  in_progress: "text-[var(--color-status-in-progress-fg)]",
  paused: "text-[var(--color-status-at-risk-fg)]",
  postponed: NEUTRAL_TONE,
  planned: NEUTRAL_TONE,
  wont_do: NEUTRAL_TONE,
};

function Glyph({
  children,
  className = ICON_CLASS,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export type ProgressIconStatus =
  StatusOverviewItem["workflowStatus"] | "wont_do";

const PROGRESS_SHAPES: Readonly<Record<ProgressIconStatus, React.ReactNode>> = {
  done: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  in_progress: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 019 9h-9z" fill="currentColor" stroke="none" />
    </>
  ),
  paused: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  postponed: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  planned: <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />,
  wont_do: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
};

/**
 * Progress glyph per stored workflow status. `unconfirmed` adds a filled dot
 * in the corner: the item carried over and has not been updated this week.
 */
export function ProgressIcon({
  status,
  unconfirmed = false,
}: {
  readonly status: ProgressIconStatus;
  readonly unconfirmed?: boolean;
}) {
  return (
    <Glyph className={`${ICON_CLASS} ${PROGRESS_TONE[status]}`}>
      {PROGRESS_SHAPES[status]}
      {unconfirmed ? (
        <circle
          cx="19"
          cy="5"
          r="3.5"
          fill="currentColor"
          stroke="var(--color-card)"
        />
      ) : null}
    </Glyph>
  );
}

const NEXT_WEEK_SHAPE = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8M13 9l3 3-3 3" />
  </>
);

// Each verdict keeps the shape of the canonical status it records; Next week
// has no status of its own, so it gets the one arrow glyph.
const VERDICT_STATUS: Readonly<
  Record<Exclude<PlanVerdict, "next">, ProgressIconStatus>
> = {
  done: "done",
  continue: "in_progress",
  paused: "paused",
  wont_do: "wont_do",
};

export function VerdictIcon({ verdict }: { readonly verdict: PlanVerdict }) {
  if (verdict === "next")
    return (
      <Glyph className={`${ICON_CLASS} ${NEUTRAL_TONE}`}>
        {NEXT_WEEK_SHAPE}
      </Glyph>
    );
  return <ProgressIcon status={VERDICT_STATUS[verdict]} />;
}
