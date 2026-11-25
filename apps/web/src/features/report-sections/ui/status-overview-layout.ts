export const STATUS_OVERVIEW_DESKTOP_GRID = "overview-week-grid";

export const STATUS_OVERVIEW_COLUMN_HEADER_IDS = {
  previouslyPlanned: "status-overview-previously-planned-heading",
  currentWeek: "status-overview-current-week-heading",
  nextWeek: "status-overview-next-week-heading",
} as const;

export const STATUS_OVERVIEW_COLUMNS = [
  { key: "previouslyPlanned", source: "previous", label: "Last week" },
  { key: "currentWeek", source: "current", label: "This week" },
  { key: "nextWeek", source: "next", label: "Next week" },
] as const;

export const TIMELINE_GRID = STATUS_OVERVIEW_DESKTOP_GRID;
export const TIMELINE_CELL =
  "min-w-0 px-4 py-3 first:md:border-l-0 md:border-l md:border-[var(--color-border-subtle)]";
