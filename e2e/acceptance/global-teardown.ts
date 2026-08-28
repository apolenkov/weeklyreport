import * as path from "node:path";

import { runAcceptanceTeardown } from "./lifecycle.ts";

export default async function globalTeardown(): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const resultsRoot = path.join(import.meta.dirname, ".results");
  await runAcceptanceTeardown(repoRoot, resultsRoot);
}
