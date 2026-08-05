import { rm } from "node:fs/promises";
import * as path from "node:path";

export const RUNTIME_NEXT_DIST = {
  live: ".next-runtime-sweep",
  preflight: ".next-runtime-preflight",
} as const;

type RuntimeNextDist =
  (typeof RUNTIME_NEXT_DIST)[keyof typeof RUNTIME_NEXT_DIST];

export const parseRuntimeNextDist = (
  value: string | undefined,
): RuntimeNextDist => {
  const match = Object.values(RUNTIME_NEXT_DIST).find((name) => name === value);
  if (match === undefined)
    throw new Error("Unknown runtime Next dist directory");
  return match;
};

export const resetRuntimeNextDist = (
  repoRoot: string,
  distDirectory: RuntimeNextDist,
): Promise<void> =>
  rm(path.join(repoRoot, "apps", "web", distDirectory), {
    force: true,
    recursive: true,
    maxRetries: 3,
    retryDelay: 100,
  });
