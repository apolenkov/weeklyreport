import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ESM has no `require.main`, and the CommonJS-era `require.main === module`
// guard evaluates to false under it — silently turning a script into a no-op.
// `process.argv[1]` may be relative to cwd, so resolve before comparing.
export const isEntrypoint = (moduleUrl: string): boolean =>
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(moduleUrl);
