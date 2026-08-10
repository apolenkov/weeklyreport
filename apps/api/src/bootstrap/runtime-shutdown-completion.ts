import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const SOURCE_SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;
const sourceShaSchema = z
  .string()
  .regex(new RegExp(`^[0-9a-f]{${String(SOURCE_SHA_LENGTH)}}$`));
const digestSchema = z
  .string()
  .regex(new RegExp(`^[0-9a-f]{${String(DIGEST_LENGTH)}}$`));
const completionInputSchema = z
  .object({
    filePath: z.string().min(1).refine(path.isAbsolute),
    completion: z
      .object({
        artifact: z.literal("RUNTIME_PROFILE_SHUTDOWN_COMPLETE"),
        version: z.literal(1),
        sourceSha: sourceShaSchema,
        matrixDigest: digestSchema,
        assignmentDigest: digestSchema,
        runId: z.uuid(),
        laneId: z.string().min(1),
        profile: z.enum(["minimal", "demo", "full", "stress"]),
        serviceName: z.string().min(1),
        startedAt: z.iso.datetime(),
      })
      .strict(),
  })
  .strict();

export const runtimeShutdownCompletionWriter = (
  value: string | undefined,
): (() => Promise<void>) | undefined => {
  if (value === undefined) return undefined;
  const input = completionInputSchema.parse(JSON.parse(value));
  return async (): Promise<void> => {
    const completion = {
      ...input.completion,
      completedAt: new Date().toISOString(),
      acknowledgement: "api-drains-complete",
    } as const;
    await mkdir(path.dirname(input.filePath), { recursive: true });
    await writeFile(
      input.filePath,
      `${JSON.stringify(completion, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
  };
};
