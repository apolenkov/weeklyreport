import type { KanbanItem } from "../types";
import type { ActivityBucket } from "./activity-buckets";

// Shared projection model for the unified activity view. It is deliberately
// hook-free so both view-model construction and editing can consume it.
export interface UnifiedActivityEntry {
  readonly item: KanbanItem;
  readonly bucket: ActivityBucket;
  readonly week: "current" | "next";
}
