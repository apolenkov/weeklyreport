import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ESM has no `require.main`, and the CommonJS-era `require.main === module`
// guard evaluates to false under it — silently turning a script into a no-op.
// Node resolves the loaded module to its canonical path, while `process.argv[1]`
// keeps the path as invoked: a symlink alias would compare unequal and skip the
// script. The loaded module always exists, so its canonical path is read
// directly. An argv path that names nothing on disk cannot be the loaded
// module, while another filesystem failure is a real error to surface.
const canonicalModulePath = (moduleUrl: string): string =>
  realpathSync(resolve(fileURLToPath(moduleUrl)));

const canonicalArgvPath = (path: string): string | null => {
  try {
    return realpathSync(resolve(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const isEntrypoint = (moduleUrl: string): boolean => {
  const argvPath = process.argv[1];
  if (argvPath === undefined) return false;
  const canonicalArgv = canonicalArgvPath(argvPath);
  return (
    canonicalArgv !== null && canonicalArgv === canonicalModulePath(moduleUrl)
  );
};
