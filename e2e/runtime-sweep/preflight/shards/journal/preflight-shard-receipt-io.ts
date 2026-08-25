import { readFile } from "node:fs/promises";

import { writeManifestFile } from "../../../source/manifest-source.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
} from "../../preflight-archive-path.ts";
import { PreflightShardJournalError } from "./preflight-shard-journal-contract.ts";

export const assertExactPreflightShardArtifactPath = (
  actual: string,
  expected: string,
  message: string,
): void => {
  if (actual !== expected) throw new PreflightShardJournalError(message);
};

export const writeCanonicalPreflightShardArtifact = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly value: unknown;
}): Promise<void> => {
  await assertPreflightArchivePath(input.archiveRoot, input.filePath);
  await writeManifestFile(input.filePath, `${stableSerialize(input.value)}\n`);
  await assertPreflightRegularFile(input.filePath);
};

export const readCanonicalPreflightShardArtifact = async (input: {
  readonly archiveRoot: string;
  readonly filePath: string;
}): Promise<unknown> => {
  await assertPreflightArchivePath(input.archiveRoot, input.filePath);
  await assertPreflightRegularFile(input.filePath);
  const text = await readFile(input.filePath, "utf8");
  const value = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch (error: unknown) {
      throw new PreflightShardJournalError(
        `Cannot parse immutable artifact ${input.filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();
  if (`${stableSerialize(value)}\n` !== text)
    throw new PreflightShardJournalError(
      `Immutable artifact bytes are not canonical: ${input.filePath}`,
    );
  return value;
};
