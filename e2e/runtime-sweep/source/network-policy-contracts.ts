import { z } from "zod";

const networkOperationSchema = z.string().trim().min(1);

export const networkEvidencePolicySchema = z
  .object({
    maxRepeatedApiRequests: z.number().int().positive(),
    retryStormThreshold: z.number().int().positive(),
    slowRequestThresholdMs: z.number().int().positive(),
    cacheExpectedOperations: z.array(networkOperationSchema).readonly(),
  })
  .strict()
  .superRefine(({ cacheExpectedOperations }, context) => {
    if (
      new Set(cacheExpectedOperations).size !== cacheExpectedOperations.length
    )
      context.addIssue({
        code: "custom",
        path: ["cacheExpectedOperations"],
        message: "cache expected operations must be unique",
      });
  });

export const routeNetworkPolicySchema = networkEvidencePolicySchema.nullable();
export const NO_ROUTE_CACHE_CONTRACT_POLICY = {
  maxRepeatedApiRequests: 3,
  retryStormThreshold: 5,
  slowRequestThresholdMs: 5000,
  cacheExpectedOperations: [] as const,
} as const satisfies z.infer<typeof networkEvidencePolicySchema>;
