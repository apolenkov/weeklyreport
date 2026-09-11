import { z } from "zod";

/** Maximum capability checks retained for one provider test execution. */
export const AI_PROVIDER_TEST_CHECK_LIMIT = 32;
/** Maximum length of bounded provider test check and failure codes. */
export const AI_PROVIDER_TEST_FAILURE_CODE_LIMIT = 80;

/** Durable processing states for a provider test execution. */
export const aiProviderTestExecutionStateSchema = z.enum([
  "queued",
  "running",
  "completed",
]);

/** Safe terminal outcomes exposed for a provider test. */
export const aiProviderTestOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "configuration_error",
  "inconclusive",
]);

/** Safe outcomes recorded for an individual capability check. */
export const aiProviderTestCheckOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "inconclusive",
]);

/** Bounded result counters for one provider capability check. */
export const aiProviderTestCheckSchema = z
  .object({
    code: z.string().trim().min(1).max(AI_PROVIDER_TEST_FAILURE_CODE_LIMIT),
    outcome: aiProviderTestCheckOutcomeSchema,
    passedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  })
  .strict();

/** Safe read model for provider test progress and results. */
export const aiProviderTestExecutionReadSchema = z
  .object({
    id: z.uuid(),
    testSuiteVersion: z.string().trim().min(1),
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

/** Provider test execution returned to administrator clients. */
export type AiProviderTestExecutionRead = z.infer<
  typeof aiProviderTestExecutionReadSchema
>;
