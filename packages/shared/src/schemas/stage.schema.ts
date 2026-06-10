import { z } from "zod";

// ---------------------------------------------------------------------------
// v4.0: Stage & Assignment schemas (D-63)
// ---------------------------------------------------------------------------

export const stageSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const stageAssignmentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  stageId: z.uuid(),
  projectId: z.uuid(),
  stageName: z.string().min(1),
  userName: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// v4.0: Version snapshot (D-67)
// ---------------------------------------------------------------------------

/** Mirrors the Prisma VersionSnapshotKind enum (add-version-pin). */
export const versionSnapshotKindSchema = z.enum(["autosave", "pinned"]);

export const versionSnapshotSchema = z.object({
  id: z.uuid(),
  reportSectionId: z.uuid(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  /**
   * Snapshot kind: routine autosave or a lead-pinned checkpoint.
   * Default 'autosave' keeps legacy rows and pre-existing callers parsing
   * — same default pattern as the count fields below.
   */
  kind: versionSnapshotKindSchema.default("autosave"),
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
export type VersionSnapshotKind = z.infer<typeof versionSnapshotKindSchema>;
export type VersionSnapshot = z.infer<typeof versionSnapshotSchema>;
