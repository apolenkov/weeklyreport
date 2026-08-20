import { z } from "zod";

export const AI_PROVIDER_TEST_CHECK_LIMIT = 32;
export const AI_PROVIDER_TEST_FAILURE_CODE_LIMIT = 80;

export const aiProviderTestExecutionStateSchema = z.enum([
  "queued",
  "running",
  "completed",
]);

export const aiProviderTestOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "configuration_error",
  "inconclusive",
]);

export const aiProviderTestCheckOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "inconclusive",
]);

export const aiProviderTestCheckSchema = z
  .object({
    code: z.string().trim().min(1).max(AI_PROVIDER_TEST_FAILURE_CODE_LIMIT),
    outcome: aiProviderTestCheckOutcomeSchema,
    passedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  })
  .strict();

export const aiProviderTestExecutionReadSchema = z
  .object({
    id: z.uuid(),
    state: aiProviderTestExecutionStateSchema,
    outcome: aiProviderTestOutcomeSchema.nullable(),
    failureCode: z
      .string()
      .trim()
      .min(1)
      .max(AI_PROVIDER_TEST_FAILURE_CODE_LIMIT)
      .nullable(),
    checks: z
      .array(aiProviderTestCheckSchema)
      .max(AI_PROVIDER_TEST_CHECK_LIMIT),
    requestedAt: z.coerce.date(),
    startedAt: z.coerce.date().nullable(),
    completedAt: z.coerce.date().nullable(),
  })
  .strict();

export type AiProviderTestExecutionRead = z.infer<
  typeof aiProviderTestExecutionReadSchema
>;
