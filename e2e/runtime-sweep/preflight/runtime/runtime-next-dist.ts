import { mkdir, readdir, rm } from "node:fs/promises";
import * as path from "node:path";

/**
 * Translate a proof-owned absolute directory to the value consumed by the
 * Next config. Next resolves `distDir` with `path.join(appRoot, distDir)`;
 * passing an absolute proof path therefore appends it under `appRoot` rather
 * than selecting the proof path. Keep the proof path absolute for identity,
 * and only expose this reversible relative representation to Next.
 */
export const nextDistDirForNextConfig = (
  appRoot: string,
  proofDistDir: string,
): string => {
  const normalizedAppRoot = path.resolve(appRoot);
  if (
    !path.isAbsolute(proofDistDir) ||
    path.resolve(proofDistDir) !== proofDistDir
  )
    throw new Error(
      "Proof-owned Next dist directory must be a normalized absolute path",
    );
  const normalizedProofDistDir = path.resolve(proofDistDir);
  const configDistDir = path.relative(
    normalizedAppRoot,
    normalizedProofDistDir,
  );
  if (configDistDir === "" || path.isAbsolute(configDistDir))
    throw new Error("Proof-owned Next dist directory cannot be app root");
  if (path.join(normalizedAppRoot, configDistDir) !== normalizedProofDistDir)
    throw new Error("Proof-owned Next dist directory is not reversible");
  return configDistDir;
};

export const RUNTIME_NEXT_LANES = ["sweep", "preflight"] as const;
export type RuntimeNextLane = (typeof RUNTIME_NEXT_LANES)[number];

export const parseRuntimeNextLane = (
  value: string | undefined,
): RuntimeNextLane => {
  const match = RUNTIME_NEXT_LANES.find((lane) => lane === value);
  if (match === undefined) throw new Error("Unknown runtime Next lane");
  return match;
};

export const runtimeNextDistName = (
  lane: RuntimeNextLane,
  ownerPid: number,
): string => `.next-runtime-${lane}-${ownerPid}`;

const ownerPidFrom = (name: string, lane: RuntimeNextLane): number | null => {
  const match = new RegExp(
    String.raw`^\.next-runtime-${lane}-(\d+)$`,
    "u",
  ).exec(name);
  const ownerPid = Number(match?.[1]);
  return Number.isSafeInteger(ownerPid) && ownerPid > 0 ? ownerPid : null;
};

const processIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return !(
      error instanceof Error &&
      "code" in error &&
      error.code === "ESRCH"
    );
  }
};

export const staleRuntimeNextDistNames = (
  names: readonly string[],
  lane: RuntimeNextLane,
  ownerPid: number,
  isAlive: (pid: number) => boolean = processIsAlive,
): readonly string[] =>
  names.filter((name) => {
    const candidatePid = ownerPidFrom(name, lane);
    return (
      candidatePid !== null &&
      candidatePid !== ownerPid &&
      !isAlive(candidatePid)
    );
  });

const removeRuntimeNextDist = (webRoot: string, name: string): Promise<void> =>
  rm(path.join(webRoot, name), {
    force: true,
    recursive: true,
    maxRetries: 3,
    retryDelay: 100,
  });

export const prepareRuntimeNextDist = async (
  webRoot: string,
  lane: RuntimeNextLane,
  ownerPid: number,
): Promise<string> => {
  const entries = await readdir(webRoot, { withFileTypes: true });
  const directoryNames = entries
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name);
  const staleNames = staleRuntimeNextDistNames(directoryNames, lane, ownerPid);
  await Promise.all(
    staleNames.map((name) => removeRuntimeNextDist(webRoot, name)),
  );
  const ownName = runtimeNextDistName(lane, ownerPid);
  await removeRuntimeNextDist(webRoot, ownName);
  await mkdir(path.join(webRoot, ownName), { recursive: false });
  return ownName;
};

export const releaseRuntimeNextDist = (
  webRoot: string,
  name: string,
): Promise<void> => removeRuntimeNextDist(webRoot, name);
