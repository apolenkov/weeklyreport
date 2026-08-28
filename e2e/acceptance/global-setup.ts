import * as path from "node:path";

import { runDefaultAcceptanceSetup } from "./lifecycle.ts";

export default async function globalSetup(): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const resultsRoot = path.join(import.meta.dirname, ".results");
  await runDefaultAcceptanceSetup(repoRoot, resultsRoot);
}
