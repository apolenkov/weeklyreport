import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { SeedProfile } from "./seed-profile-contract.js";

interface SeedStep {
  readonly script: string;
  readonly args: readonly string[];
}

const SIMPLE_WRITER = { script: "seed-simple.ts", args: [] } as const;
const PROFILE_STEPS = {
  minimal: [{ script: "seed-minimal.ts", args: [] }],
  demo: [SIMPLE_WRITER],
  full: [SIMPLE_WRITER, { script: "seed.ts", args: [] }],
  stress: [
    SIMPLE_WRITER,
    { script: "seed.ts", args: [] },
    { script: "seed-stress-overlay.ts", args: [] },
  ],
} as const satisfies Record<SeedProfile, readonly SeedStep[]>;

export function seedStepsFor(profile: SeedProfile): readonly SeedStep[] {
  return PROFILE_STEPS[profile];
}

export function runSeedProfile(profile: SeedProfile): void {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  for (const step of seedStepsFor(profile)) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL(step.script, import.meta.url)),
        ...step.args,
      ],
      {
        cwd: repoRoot,
        env: { ...process.env },
        shell: false,
        stdio: "inherit",
      },
    );
    if (result.status !== 0) {
      throw new Error(
        `${step.script} failed for ${profile} with exit code ${result.status ?? "unknown"}`,
      );
    }
  }
}
