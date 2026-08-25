import path from "node:path";

import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { finalizeRuntimeCoverage } from "./finalize-runtime-coverage.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime coverage finalizer requires ${name}`);
  return value;
};

async function main(): Promise<void> {
  await assertRuntimeSourceAuthorityFromEnvironment();
  const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
  const cells = await finalizeRuntimeCoverage({ archiveRoot });
  console.log(`runtime-coverage PASS cells=${cells.length}`);
}

void main().catch((error: unknown) => {
  console.error("[runtime-coverage] Failed:", error);
  process.exitCode = 1;
});
