import { z } from "zod";

export const AI_COMPATIBILITY_CHECK_LIMIT = 32;
export const AI_COMPATIBILITY_FAILURE_CODE_LIMIT = 80;

export const aiCompatibilityExecutionStateSchema = z.enum([
  "queued",
  "running",
  "completed",
]);

export const aiCompatibilityOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "configuration_error",
  "inconclusive",
]);

export const aiCompatibilityCheckOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "inconclusive",
]);

export const aiCompatibilityCheckSchema = z
  .object({
    code: z.string().trim().min(1).max(AI_COMPATIBILITY_FAILURE_CODE_LIMIT),
    outcome: aiCompatibilityCheckOutcomeSchema,
    passedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  })
  .strict();

export const aiCompatibilityExecutionReadSchema = z
  .object({
    id: z.uuid(),
    state: aiCompatibilityExecutionStateSchema,
    outcome: aiCompatibilityOutcomeSchema.nullable(),
    failureCode: z
      .string()
      .trim()
      .min(1)
      .max(AI_COMPATIBILITY_FAILURE_CODE_LIMIT)
      .nullable(),
    checks: z
      .array(aiCompatibilityCheckSchema)
      .max(AI_COMPATIBILITY_CHECK_LIMIT),
    requestedAt: z.coerce.date(),
    startedAt: z.coerce.date().nullable(),
    completedAt: z.coerce.date().nullable(),
  })
  .strict();

export type AiCompatibilityExecutionRead = z.infer<
  typeof aiCompatibilityExecutionReadSchema
>;
