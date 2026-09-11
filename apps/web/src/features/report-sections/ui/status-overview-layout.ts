import type { StatusOverviewUnit } from "../model/status-overview";

export const STATUS_OVERVIEW_DESKTOP_GRID =
  "min-[80rem]:grid min-[80rem]:grid-cols-[repeat(4,minmax(0,1fr))]";

export type StatusOverviewColumnKey = keyof StatusOverviewUnit["columns"];

export const STATUS_OVERVIEW_COLUMNS = [
  { key: "previouslyPlanned", source: "previous", label: "Previously planned" },
  { key: "currentWeek", source: "current", label: "Current week" },
  { key: "nextWeek", source: "next", label: "Next week" },
] as const;

export const TIMELINE_GRID = "md:grid md:grid-cols-3";
export const TIMELINE_CELL =
  "min-w-0 px-4 py-3 md:border-l md:border-[var(--color-border-subtle)]";
