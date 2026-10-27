import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ESM has no `require.main`, and the CommonJS-era `require.main === module`
// guard evaluates to false under it — silently turning a script into a no-op.
// Node resolves the loaded module to its canonical path, while `process.argv[1]`
// keeps the path as invoked: a symlink alias would compare unequal and skip the
// script. Both sides are canonicalized, falling back to the absolute path when
// the filesystem cannot resolve it, so the predicate stays total.
const canonicalPath = (path: string): string => {
  const absolute = resolve(path);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
};

export const isEntrypoint = (moduleUrl: string): boolean =>
  process.argv[1] !== undefined &&
  canonicalPath(process.argv[1]) === canonicalPath(fileURLToPath(moduleUrl));
