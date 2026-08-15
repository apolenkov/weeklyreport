import { readdir, stat } from "node:fs/promises";
import * as path from "node:path";

import type {
  CapacitySurveyPlan,
  CapacitySurveyResult,
} from "../capacity/preflight-capacity-survey-contract.ts";
import {
  readCapacitySurveyPlan,
  serializeCapacitySurveyPlan,
  serializeCapacitySurveyResult,
  writeCapacitySurveyResult,
} from "../capacity/preflight-capacity-survey-io.ts";

export const assertBoundedCapacitySurveyByteSet = (input: {
  readonly fileBytes: readonly number[];
  readonly maxPerFileBytes: number;
  readonly maxAggregateArchiveBytes: number;
}): void => {
  if (input.fileBytes.some((bytes) => bytes > input.maxPerFileBytes))
    throw new Error("Capacity survey publication exceeds maxPerFileBytes");
  const aggregateBytes = input.fileBytes.reduce(
    (total, bytes) => total + bytes,
    0,
  );
  if (aggregateBytes > input.maxAggregateArchiveBytes)
    throw new Error(
      "Capacity survey publication exceeds maxAggregateArchiveBytes",
    );
};

export const assertBoundedCapacitySurveyDirectory = async (input: {
  readonly directory: string;
  readonly expectedNames: readonly string[];
  readonly maxPerFileBytes: number;
  readonly maxAggregateArchiveBytes: number;
}): Promise<void> => {
  const entries = await readdir(input.directory, { withFileTypes: true });
  const names = entries
    .map(({ name }) => name)
    .toSorted((left, right) => left.localeCompare(right));
  const expected = [...input.expectedNames].toSorted((left, right) =>
    left.localeCompare(right),
  );
  if (names.join("\0") !== expected.join("\0"))
    throw new Error(
      `Capacity survey archive contains unexpected files: ${names.join(", ")}`,
    );
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error(
          `Capacity survey archive entry must be a regular file: ${entry.name}`,
        );
      const bytes = (await stat(path.join(input.directory, entry.name))).size;
      if (bytes > input.maxPerFileBytes)
        throw new Error(
          `Capacity survey archive file exceeds maxPerFileBytes: ${entry.name}`,
        );
      return bytes;
    }),
  );
  assertBoundedCapacitySurveyByteSet({
    fileBytes: sizes,
    maxPerFileBytes: input.maxPerFileBytes,
    maxAggregateArchiveBytes: input.maxAggregateArchiveBytes,
  });
};

export const publishBoundedCapacitySurveyResult = async (input: {
  readonly archiveRoot: string;
  readonly planPath: string;
  readonly resultPath: string;
  readonly plan: CapacitySurveyPlan;
  readonly result: CapacitySurveyResult;
}): Promise<void> => {
  const planText = serializeCapacitySurveyPlan(input.plan);
  const resultText = serializeCapacitySurveyResult(input.result);
  assertBoundedCapacitySurveyByteSet({
    fileBytes: [
      Buffer.byteLength(planText, "utf8"),
      Buffer.byteLength(resultText, "utf8"),
    ],
    maxPerFileBytes: input.plan.limits.maxPerFileBytes,
    maxAggregateArchiveBytes: input.plan.limits.maxAggregateArchiveBytes,
  });
  const persistedPlan = await readCapacitySurveyPlan({
    archiveRoot: input.archiveRoot,
    filePath: input.planPath,
  });
  if (serializeCapacitySurveyPlan(persistedPlan) !== planText)
    throw new Error("Capacity survey plan changed before result publication");
  await assertBoundedCapacitySurveyDirectory({
    directory: path.dirname(input.planPath),
    expectedNames: [path.basename(input.planPath)],
    maxPerFileBytes: input.plan.limits.maxPerFileBytes,
    maxAggregateArchiveBytes: input.plan.limits.maxAggregateArchiveBytes,
  });
  await writeCapacitySurveyResult({
    archiveRoot: input.archiveRoot,
    filePath: input.resultPath,
    result: input.result,
  });
};

export const capacitySurveyChildEnvironment = (input: {
  readonly inherited: NodeJS.ProcessEnv;
  readonly archiveRoot: string;
  readonly sourcePath: string;
  readonly planPath: string;
  readonly resultPath: string;
  readonly resultRoot: string;
  readonly tempRoot: string;
  readonly maxDurationMs: number;
}): NodeJS.ProcessEnv => {
  const environment = Object.fromEntries(
    Object.entries(input.inherited).filter(
      ([key]) =>
        !key.startsWith("RUNTIME_SWEEP_PREFLIGHT") &&
        !key.startsWith("RUNTIME_SWEEP_CANARY") &&
        !key.startsWith("RUNTIME_SWEEP_CAPACITY_SURVEY") &&
        key !== "RUNTIME_SWEEP_CAMPAIGN_KIND",
    ),
  );
  return {
    ...environment,
    RUNTIME_SWEEP_PREFLIGHT_MODE: "capacity-survey",
    RUNTIME_SWEEP_ARCHIVE: input.archiveRoot,
    RUNTIME_SWEEP_SOURCE: input.sourcePath,
    RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN: input.planPath,
    RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT: input.resultPath,
    RUNTIME_SWEEP_CAPACITY_SURVEY_RESULT_ROOT: input.resultRoot,
    RUNTIME_SWEEP_CAPACITY_SURVEY_TEMP_ROOT: input.tempRoot,
    RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS: String(input.maxDurationMs),
  };
};
