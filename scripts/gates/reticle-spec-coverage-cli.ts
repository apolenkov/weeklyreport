import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isSafeReticleSegment } from "./reticle-flow-validation.ts";
import {
  inventoryOpenSpecScenarios,
  refreshReticleSpecCoverage,
  summarizeOpenSpecInventory,
  validateReticleSpecCoverage,
} from "./reticle-spec-coverage.ts";

const root = process.cwd();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readProjectId(): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(join(root, "apps/web/.reticle.json"), "utf8"),
    ) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("apps/web/.reticle.json must contain valid JSON");
    throw error;
  }
  if (!isRecord(parsed) || !isSafeReticleSegment(parsed.projectId)) {
    throw new Error("apps/web/.reticle.json must define projectId");
  }
  return parsed.projectId;
}

const projectId = await readProjectId();
const registryPath = join(root, ".reticle/spec-coverage.json");
const exclusionsPath = join(root, ".reticle/spec-coverage-exclusions.json");
const specsRoot = join(root, "openspec/specs");

if (process.argv.includes("--refresh")) {
  await refreshReticleSpecCoverage({
    specsRoot,
    registryPath,
    projectId,
    exclusionsPath,
  });
  const summary = summarizeOpenSpecInventory(
    await inventoryOpenSpecScenarios(specsRoot),
  );
  console.log(
    `Refreshed ${summary.scenarios} OpenSpec scenarios and ${summary.outcomes} outcomes.`,
  );
} else {
  const summary = await validateReticleSpecCoverage({
    specsRoot,
    registryPath,
    flowsRoot: join(root, ".reticle/flows", projectId),
    projectId,
    exclusionsPath,
  });
  console.log(JSON.stringify(summary));
}
