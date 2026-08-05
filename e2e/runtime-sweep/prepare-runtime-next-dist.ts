import * as path from "node:path";

import {
  parseRuntimeNextDist,
  resetRuntimeNextDist,
} from "./runtime-next-dist.ts";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
await resetRuntimeNextDist(repoRoot, parseRuntimeNextDist(process.argv[2]));
