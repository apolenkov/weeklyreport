import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import type { ServerLogRecord } from "../../evidence/evidence-types.ts";
import { parseServerLogText } from "../../evidence/server-log-evidence.ts";

const unzip = promisify(gunzip);

export type RuntimeProfileLog = Readonly<{
  readonly records: readonly ServerLogRecord[];
  readonly malformedCount: number;
  readonly files: readonly string[];
}>;

const readLogFile = async (filePath: string): Promise<string> =>
  filePath.endsWith(".gz")
    ? (await unzip(await readFile(filePath))).toString("utf8")
    : readFile(filePath, "utf8");

export const readRuntimeProfileLog = async (
  logDirectory: string,
): Promise<RuntimeProfileLog> => {
  const names = await readdir(logDirectory);
  const files = [
    ...names
      .filter((name) => name.startsWith("app.log.") && name.endsWith(".gz"))
      .toSorted((left, right) => left.localeCompare(right)),
    ...(names.includes("app.log") ? ["app.log"] : []),
  ];
  if (files.length === 0)
    throw new Error("Runtime profile app.log and its archives are missing");
  const parsed = await Promise.all(
    files.map(async (name) =>
      parseServerLogText(await readLogFile(path.join(logDirectory, name))),
    ),
  );
  return {
    records: parsed.flatMap(({ records }) => records),
    malformedCount: parsed.reduce(
      (total, value) => total + value.malformedCount,
      0,
    ),
    files,
  };
};
