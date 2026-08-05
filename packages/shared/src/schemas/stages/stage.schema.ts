import { z } from "zod";

/** Validates an ordered SDLC stage definition. */
export const stageSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    sortOrder: z.number().int().min(0),
  })
  .readonly();

/** Validates one user-stage-product accountability edge. */
export const stageAssignmentSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    stageId: z.uuid(),
    projectId: z.uuid(),
    stageName: z.string().min(1),
    userName: z.string().min(1).optional(),
  })
  .readonly();

/** Ordered SDLC stage identity. */
export type Stage = z.infer<typeof stageSchema>;
/** User-product-stage accountability edge with optional display name. */
export type StageAssignment = z.infer<typeof stageAssignmentSchema>;
