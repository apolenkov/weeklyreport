import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { assertE2eRuntimeDestructive } from "../../guards/_destructive-guard.js";
import type { SeedProfile } from "./seed-profile-contract.js";

interface SeedStep {
  readonly script: string;
  readonly args: readonly string[];
}

const SIMPLE_WRITER = { script: "../simple/seed-simple.ts", args: [] } as const;
const PROFILE_STEPS = {
  minimal: [{ script: "../minimal/seed-minimal.ts", args: [] }],
  demo: [SIMPLE_WRITER],
  full: [SIMPLE_WRITER, { script: "../../seed.ts", args: [] }],
  stress: [
    SIMPLE_WRITER,
    { script: "../../seed.ts", args: [] },
    { script: "../stress/seed-stress-overlay.ts", args: [] },
  ],
} as const satisfies Record<SeedProfile, readonly SeedStep[]>;

export function seedStepsFor(profile: SeedProfile): readonly SeedStep[] {
  return PROFILE_STEPS[profile];
}

export function runSeedProfile(profile: SeedProfile): void {
  // Keep the child-process boundary guarded even when a caller imports this
  // runner directly instead of going through seed-profile.ts.
  assertE2eRuntimeDestructive(`seed-profile:${profile}`);
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const steps = [
    ...seedStepsFor(profile),
    // Opt-in overlay: no-ops unless E2E_AI_PROVIDER_API_KEY is set.
    { script: "../../seed-ai-provider.ts", args: [] },
    { script: "./seed-profile-validate.ts", args: [profile] },
  ];
  for (const step of steps) {
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
