import type { StatusOverviewItem } from "../model/status-overview";

// Compact metadata glyphs for the Overview. Every icon is decorative: the
// adjacent text keeps the meaning for assistive tech and for colour-blind use.
const ICON_CLASS = "h-3.5 w-3.5 shrink-0";

// Only completion and active work take a semantic hue; waiting states stay
// neutral so the amber/red alarm hues keep meaning health, not progress.
const PROGRESS_TONE: Readonly<
  Record<StatusOverviewItem["workflowStatus"], string>
> = {
  done: "text-[var(--color-chip-on-track-text)]",
  in_progress: "text-[var(--color-status-in-progress-fg)]",
  paused: "text-[var(--color-status-at-risk-fg)]",
  postponed: "text-[var(--color-muted-foreground)]",
  planned: "text-[var(--color-muted-foreground)]",
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

/** Progress glyph per stored workflow status. */
export function ProgressIcon({
  status,
}: {
  readonly status: StatusOverviewItem["workflowStatus"];
}) {
  const tone = `${ICON_CLASS} ${PROGRESS_TONE[status]}`;
  if (status === "done") {
    return (
      <Glyph className={tone}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </Glyph>
    );
  }
  if (status === "in_progress") {
    return (
      <Glyph className={tone}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 019 9h-9z" fill="currentColor" stroke="none" />
      </Glyph>
    );
  }
  if (status === "paused") {
    return (
      <Glyph className={tone}>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 9v6M14 9v6" />
      </Glyph>
    );
  }
  if (status === "postponed") {
    return (
      <Glyph className={tone}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </Glyph>
    );
  }
  return (
    <Glyph className={tone}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
    </Glyph>
  );
}

const TAG_PATHS: Readonly<Record<string, React.ReactNode>> = {
  feature: (
    <path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.3 5.6L12 15.4 7.1 18.2l1.3-5.6L4 8.8l5.8-.5z" />
  ),
  bugfix: (
    <>
      <circle cx="12" cy="13" r="5" />
      <path d="M12 8V6M8.5 9.5L7 8M15.5 9.5L17 8M7 13H5M19 13h-2M8.5 16.5L7 18M15.5 16.5L17 18" />
    </>
  ),
  infra: (
    <>
      <rect x="4" y="5" width="16" height="6" rx="1.5" />
      <rect x="4" y="13" width="16" height="6" rx="1.5" />
    </>
  ),
  ops: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" />
    </>
  ),
  analysis: (
    <>
      <path d="M4 19h16" />
      <path d="M7 19V9M12 19V5M17 19v-7" />
    </>
  ),
  delivery: (
    <>
      <path d="M4 8l8-4 8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8" />
    </>
  ),
};

/** Stage/tag glyph; unknown tags fall back to a neutral tag glyph. */
export function TagIcon({ tag }: { readonly tag: string }) {
  const path = TAG_PATHS[tag.toLowerCase()];
  return (
    <Glyph>
      {path ?? (
        <>
          <path d="M20.6 12.6L12 21.2 3.4 12.6V4h8.6z" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </>
      )}
    </Glyph>
  );
}

/** Glyph for the stage chips; stages share one neutral mark by design. */
export function StageIcon() {
  return (
    <Glyph>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </Glyph>
  );
}
