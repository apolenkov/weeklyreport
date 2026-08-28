import * as path from "node:path";

import { runDefaultAcceptanceTeardown } from "./lifecycle.ts";

export default async function globalTeardown(): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const resultsRoot = path.join(import.meta.dirname, ".results");
  await runDefaultAcceptanceTeardown(repoRoot, resultsRoot);
}
