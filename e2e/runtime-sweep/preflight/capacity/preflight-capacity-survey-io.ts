import { lstat, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../support/ids.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
  ensurePreflightArchiveDirectory,
  ensurePreflightArchiveRoot,
  PreflightArchivePathError,
} from "../preflight-archive-path.ts";
import {
  CAPACITY_SURVEY_MAX_ARTIFACT_BYTES,
  CapacitySurveyContractError,
  type CapacitySurveyPlan,
  type CapacitySurveyResult,
  parseCapacitySurveyPlan,
  parseCapacitySurveyResult,
  PREFLIGHT_CAPACITY_SURVEY_PLAN,
  PREFLIGHT_CAPACITY_SURVEY_RESULT,
} from "./preflight-capacity-survey-contract.ts";

class CapacitySurveyArtifactIOError extends Error {
  override readonly name = "CapacitySurveyArtifactIOError";
}

const missingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const bytesFor = (text: string): number => Buffer.byteLength(text, "utf8");

const assertSmallArtifact = (text: string): void => {
  const bytes = bytesFor(text);
  if (bytes > CAPACITY_SURVEY_MAX_ARTIFACT_BYTES)
    throw new CapacitySurveyArtifactIOError(
      `Capacity survey artifact exceeds the ${String(CAPACITY_SURVEY_MAX_ARTIFACT_BYTES)}-byte file ceiling`,
    );
};

const textFor = (value: CapacitySurveyPlan | CapacitySurveyResult): string => {
  const text = `${stableSerialize(value)}\n`;
  assertSmallArtifact(text);
  if (bytesFor(text) > value.limits.maxPerFileBytes)
    throw new CapacitySurveyArtifactIOError(
      "Capacity survey artifact exceeds its declared per-file bound",
    );
  return text;
};

const assertRegularImmutableTarget = async (
  filePath: string,
): Promise<void> => {
  try {
    await assertPreflightRegularFile(filePath);
  } catch (error: unknown) {
    if (error instanceof PreflightArchivePathError) throw error;
    throw new CapacitySurveyArtifactIOError(
      `Capacity survey artifact is not a readable regular file: ${filePath}`,
    );
  }
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new CapacitySurveyArtifactIOError(
      `Capacity survey artifact must be a regular non-symlink file: ${filePath}`,
    );
  if (stat.size > CAPACITY_SURVEY_MAX_ARTIFACT_BYTES)
    throw new CapacitySurveyArtifactIOError(
      `Capacity survey artifact exceeds the ${String(CAPACITY_SURVEY_MAX_ARTIFACT_BYTES)}-byte file ceiling`,
    );
};

const writeImmutable = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly text: string;
}): Promise<void> => {
  assertSmallArtifact(input.text);
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  const parent = path.dirname(input.filePath);
  if (parent !== archiveRoot)
    await ensurePreflightArchiveDirectory(archiveRoot, parent);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  try {
    await writeFile(input.filePath, input.text, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error: unknown) {
    throw new CapacitySurveyArtifactIOError(
      `Cannot create immutable capacity survey artifact at ${input.filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await assertRegularImmutableTarget(input.filePath);
  const persisted = await readFile(input.filePath, "utf8");
  if (persisted !== input.text)
    throw new CapacitySurveyArtifactIOError(
      "Capacity survey artifact changed while it was being published",
    );
};

const readArtifactText = async (filePath: string): Promise<string> => {
  try {
    const text = await readFile(filePath, "utf8");
    assertSmallArtifact(text);
    return text;
  } catch (error: unknown) {
    if (missingFile(error))
      throw new CapacitySurveyArtifactIOError(
        `Capacity survey artifact is unavailable: ${filePath}`,
      );
    throw error;
  }
};

const parseArtifactText = (input: {
  readonly artifact:
    | typeof PREFLIGHT_CAPACITY_SURVEY_PLAN
    | typeof PREFLIGHT_CAPACITY_SURVEY_RESULT;
  readonly text: string;
}): CapacitySurveyPlan | CapacitySurveyResult => {
  try {
    const value = JSON.parse(input.text) as unknown;
    return input.artifact === PREFLIGHT_CAPACITY_SURVEY_PLAN
      ? parseCapacitySurveyPlan(value)
      : parseCapacitySurveyResult(value);
  } catch (error: unknown) {
    if (error instanceof CapacitySurveyContractError) throw error;
    throw new CapacitySurveyArtifactIOError(
      `Cannot parse capacity survey artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const readCanonical = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly artifact:
    | typeof PREFLIGHT_CAPACITY_SURVEY_PLAN
    | typeof PREFLIGHT_CAPACITY_SURVEY_RESULT;
}): Promise<CapacitySurveyPlan | CapacitySurveyResult> => {
  const archiveRoot = await ensurePreflightArchiveRoot(input.archiveRoot);
  await assertPreflightArchivePath(archiveRoot, input.filePath);
  await assertRegularImmutableTarget(input.filePath);
  const text = await readArtifactText(input.filePath);
  const parsed = parseArtifactText({ artifact: input.artifact, text });
  if (parsed.artifact !== input.artifact)
    throw new CapacitySurveyArtifactIOError(
      `Expected ${input.artifact} but found ${parsed.artifact}`,
    );
  if (text !== textFor(parsed))
    throw new CapacitySurveyArtifactIOError(
      "Capacity survey artifact bytes are not canonical",
    );
  return parsed;
};

export const serializeCapacitySurveyPlan = (plan: CapacitySurveyPlan): string =>
  textFor(parseCapacitySurveyPlan(plan));

export const serializeCapacitySurveyResult = (
  result: CapacitySurveyResult,
): string => textFor(parseCapacitySurveyResult(result));

export async function writeCapacitySurveyPlan(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly plan: CapacitySurveyPlan;
}): Promise<void> {
  await writeImmutable({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    text: serializeCapacitySurveyPlan(input.plan),
  });
}

export async function writeCapacitySurveyResult(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly result: CapacitySurveyResult;
}): Promise<void> {
  await writeImmutable({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    text: serializeCapacitySurveyResult(input.result),
  });
}

export async function readCapacitySurveyPlan(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<CapacitySurveyPlan> {
  return (await readCanonical({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    artifact: PREFLIGHT_CAPACITY_SURVEY_PLAN,
  })) as CapacitySurveyPlan;
}

export async function readCapacitySurveyResult(input: {
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<CapacitySurveyResult> {
  return (await readCanonical({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    artifact: PREFLIGHT_CAPACITY_SURVEY_RESULT,
  })) as CapacitySurveyResult;
}
