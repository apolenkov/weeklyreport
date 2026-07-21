import { z } from "zod";

// Stage & Assignment schemas

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

export type Stage = z.infer<typeof stageSchema>;
export type StageAssignment = z.infer<typeof stageAssignmentSchema>;
