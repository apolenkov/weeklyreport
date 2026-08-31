import { z } from "zod";

/** Public shared schema or contract constant for a i  p r o v i d e r  t e s t  c h e c k  l i m i t. */
export const AI_PROVIDER_TEST_CHECK_LIMIT = 32;
/** Public shared schema or contract constant for a i  p r o v i d e r  t e s t  f a i l u r e  c o d e  l i m i t. */
export const AI_PROVIDER_TEST_FAILURE_CODE_LIMIT = 80;

/** Public shared schema or contract constant for ai provider test execution state schema. */
export const aiProviderTestExecutionStateSchema = z.enum([
  "queued",
  "running",
  "completed",
]);

/** Public shared schema or contract constant for ai provider test outcome schema. */
export const aiProviderTestOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "configuration_error",
  "inconclusive",
]);

/** Public shared schema or contract constant for ai provider test check outcome schema. */
export const aiProviderTestCheckOutcomeSchema = z.enum([
  "passed",
  "incompatible",
  "inconclusive",
]);

/** Public shared schema or contract constant for ai provider test check schema. */
export const aiProviderTestCheckSchema = z
  .object({
    code: z.string().trim().min(1).max(AI_PROVIDER_TEST_FAILURE_CODE_LIMIT),
    outcome: aiProviderTestCheckOutcomeSchema,
    passedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  })
  .strict();

/** Public shared schema or contract constant for ai provider test execution read schema. */
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

/** Public shared type contract for ai provider test execution read. */
export type AiProviderTestExecutionRead = z.infer<
  typeof aiProviderTestExecutionReadSchema
>;
