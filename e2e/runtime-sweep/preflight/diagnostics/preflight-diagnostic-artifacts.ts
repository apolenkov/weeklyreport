import { lstat, readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

export type DiagnosticFailureArtifacts = Readonly<{
  readonly harPath: string;
  readonly screenshotPaths: readonly string[];
  readonly videoPaths: readonly string[];
  readonly tracePaths: readonly string[];
  readonly errorContextPaths: readonly string[];
  readonly harEntryCount: number;
}>;

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRegularNonEmptyFile = async (filePath: string): Promise<boolean> => {
  try {
    const info = await lstat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
};

const filesUnder = async (root: string): Promise<readonly string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const filesFor = async (entry: (typeof entries)[number]) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath);
    return entry.isFile() ? [entryPath] : [];
  };
  return (await Promise.all(entries.map(filesFor))).flat();
};

const readJson = async (filePath: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    throw new Error(`Diagnostic HAR is not valid JSON: ${filePath}`, {
      cause: error,
    });
  }
};

const assertBodylessHar = async (harPath: string): Promise<number> => {
  if (!(await isRegularNonEmptyFile(harPath)))
    throw new Error(`Diagnostic HAR is missing or empty: ${harPath}`);
  const parsed = await readJson(harPath);
  if (!isRecord(parsed) || !isRecord(parsed.log))
    throw new Error(`Diagnostic HAR has no log object: ${harPath}`);
  const entries = parsed.log.entries;
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error(`Diagnostic HAR has no network entries: ${harPath}`);
  for (const [index, entry] of entries.entries()) {
    if (!isRecord(entry) || !isRecord(entry.response))
      throw new Error(`Diagnostic HAR entry ${index} has no response object`);
    const content = entry.response.content;
    if (!isRecord(content))
      throw new Error(`Diagnostic HAR entry ${index} has no response content`);
    if (Object.hasOwn(content, "text") || Object.hasOwn(content, "encoding"))
      throw new Error(`Diagnostic HAR entry ${index} contains a response body`);
  }
  return entries.length;
};

export const assertDiagnosticFailureArtifacts = async (input: {
  readonly outputRoot: string;
}): Promise<DiagnosticFailureArtifacts> => {
  const playwrightRoot = path.join(input.outputRoot, "playwright");
  const allFiles = await filesUnder(playwrightRoot).catch((error: unknown) => {
    throw new Error(
      `Diagnostic Playwright artifact root is unavailable: ${playwrightRoot}`,
      { cause: error },
    );
  });
  const harPath = path.join(playwrightRoot, "network.har");
  const harEntryCount = await assertBodylessHar(harPath);
  const screenshotPaths = allFiles.filter((filePath) =>
    filePath.endsWith(".png"),
  );
  const videoPaths = allFiles.filter((filePath) => filePath.endsWith(".webm"));
  const tracePaths = allFiles.filter((filePath) => filePath.endsWith(".zip"));
  const errorContextPaths = allFiles.filter((filePath) =>
    filePath.endsWith("error-context.md"),
  );
  const missing = [
    screenshotPaths.length === 0 ? "failure screenshot" : undefined,
    videoPaths.length === 0 ? "failure video" : undefined,
    tracePaths.length === 0 ? "call/source trace" : undefined,
    errorContextPaths.length === 0 ? "error context" : undefined,
  ].filter((value): value is string => value !== undefined);
  if (missing.length > 0)
    throw new Error(
      `Diagnostic failure artifact set is incomplete: ${missing.join(", ")}`,
    );
  return {
    harPath,
    screenshotPaths,
    videoPaths,
    tracePaths,
    errorContextPaths,
    harEntryCount,
  };
};
