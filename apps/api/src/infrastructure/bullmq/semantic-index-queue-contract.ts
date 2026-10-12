import { SEMANTIC_INDEX_QUEUE_NAME } from "@weeklyreport/shared";
import type { DefaultJobOptions } from "bullmq";

export { SEMANTIC_INDEX_QUEUE_NAME };
export const SEMANTIC_INDEX_JOB_NAME = "embed" as const;

export const SEMANTIC_INDEX_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
} satisfies DefaultJobOptions;
