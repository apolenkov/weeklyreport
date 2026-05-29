import { z } from "zod";

// ---------------------------------------------------------------------------
// v4.0: Stage & Assignment schemas (D-63)
// ---------------------------------------------------------------------------

export const stageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const stageAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stageId: z.string().uuid(),
  projectId: z.string().uuid(),
  stageName: z.string().min(1),
  userName: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// v4.0: Version snapshot (D-67)
// ---------------------------------------------------------------------------

export const versionSnapshotSchema = z.object({
  id: z.string().uuid(),
  reportSectionId: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  /**
   * Counts derived from the snapshot's `data` JSON column. Carried in the
   * read model so the version-history UI can render delta summaries
   * (e.g. "+1 item, +2 risks added") without fetching the full snapshot
   * payload for every row. Optional with a 0 default so legacy callers
   * that constructed snapshots without counts (pre-fix) keep parsing.
   */
  itemCount: z.number().int().min(0).default(0),
  riskCount: z.number().int().min(0).default(0),
  decisionCount: z.number().int().min(0).default(0),
});

export type Stage = z.infer<typeof stageSchema>;
export type StageAssignment = z.infer<typeof stageAssignmentSchema>;
export type VersionSnapshot = z.infer<typeof versionSnapshotSchema>;
