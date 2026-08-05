import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

import { assertNonProdDestructive } from "./_destructive-guard.js";

const REPO_ROOT = resolve(__dirname, "..");
loadEnv({ path: resolve(REPO_ROOT, ".env") });

type SeedTarget = "canonical" | "small" | "middle" | "huge";

const relationalScript = (target: SeedTarget): readonly string[] => {
  if (target === "canonical") return ["../../prisma/seed.ts"];
  if (target === "middle") return ["../../prisma/seed-simple.ts"];
  return ["../../prisma/seed-demo.ts", target];
};

const phaseCommand = (
  script: string,
  args: readonly string[] = [],
): readonly string[] => [
  "--filter",
  "@customreport/api",
  "exec",
  "tsx",
  script,
  ...args,
];

const runPhase = (name: string, args: readonly string[]): void => {
  console.log(`[seed-orchestrator] ${name}...`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- pnpm is the workspace package manager; shell:false prevents command interpolation
  const result = spawnSync("pnpm", [...args], {
    cwd: REPO_ROOT,
    env: { ...process.env },
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `[seed-orchestrator] ${name} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
};

const parseTarget = (): SeedTarget => {
  const target = process.argv[2];
  if (
    target === "canonical" ||
    target === "small" ||
    target === "middle" ||
    target === "huge"
  ) {
    return target;
  }
  throw new Error(
    `Usage: tsx prisma/seed-orchestrator.ts <canonical|small|middle|huge>`,
  );
};

const main = (): void => {
  const target = parseTarget();
  assertNonProdDestructive(`seed-orchestrator:${target}`);
  const [script, ...args] = relationalScript(target);
  if (!script) throw new Error("Seed target did not resolve to a script.");

  runPhase("relational seed", phaseCommand(script, args));
  runPhase(
    "snapshot finalization",
    phaseCommand("scripts/finalize-seeded-snapshots.ts"),
  );
  runPhase(
    "assistant readiness verification",
    phaseCommand("scripts/verify-seed-readiness.ts"),
  );
  console.log(`[seed-orchestrator] ${target} seed is ready.`);
};

main();
