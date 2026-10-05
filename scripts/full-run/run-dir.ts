import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Files of one full-run directory (see deploy/tester-kit/full-run.sh). */
export interface RunDir {
  path: string;
  read: (relative: string) => string;
  exists: (relative: string) => boolean;
  /** Sorted names in a sub directory that match the pattern. */
  files: (dir: string, pattern: RegExp) => string[];
}

export function openRun(path: string): RunDir {
  return {
    path,
    read: (relative) => readFileSync(join(path, relative), "utf8"),
    exists: (relative) => existsSync(join(path, relative)),
    files: (dir, pattern) =>
      existsSync(join(path, dir))
        ? readdirSync(join(path, dir))
            .filter((f) => pattern.test(f))
            .toSorted((a, b) => a.localeCompare(b))
        : [],
  };
}
