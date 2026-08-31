import { z } from "zod";

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

/** User-product-stage accountability edge with optional display name. */
export type StageAssignment = z.infer<typeof stageAssignmentSchema>;
