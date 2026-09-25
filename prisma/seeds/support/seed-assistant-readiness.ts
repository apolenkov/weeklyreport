import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export type SeedReadinessTier = "full" | "demo";

function isTier(value: unknown): value is SeedReadinessTier {
  return typeof value === "string" && (value === "full" || value === "demo");
}

/** Run the API-side readiness check without importing Nest into Prisma's compiler. */
export function assertAssistantReadiness(tier: unknown): void {
  if (!isTier(tier)) {
    throw new TypeError(`Unknown seed readiness tier: ${String(tier)}`);
  }
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const apiScript = fileURLToPath(
    new URL(
      "../../../apps/api/scripts/assert-seed-assistant-readiness.ts",
      import.meta.url,
    ),
  );
  const apiTsconfig = fileURLToPath(
    new URL("../../../apps/api/tsconfig.json", import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), apiScript, tier],
    {
      cwd: repoRoot,
      env: { ...process.env, TSX_TSCONFIG_PATH: apiTsconfig },
      shell: false,
      stdio: "inherit",
    },
  );
  if (result.error) {
    throw new Error(
      `Seed assistant readiness failed to start for ${tier}: ${result.error.message}`,
      { cause: result.error },
    );
  }
  if (result.signal !== null) {
    throw new Error(
      `Seed assistant readiness terminated by ${result.signal} for ${tier}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Seed assistant readiness failed for ${tier} with exit code ${result.status ?? "unknown"}`,
    );
  }
}
