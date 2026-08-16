import { describe, expect, it, vi } from "vitest";

import { SourceArtifactError } from "../source/source-artifact.ts";
import { PreflightCanaryError } from "./canary/preflight-canary.ts";
import { CapacitySurveyContractError } from "./capacity/preflight-capacity-survey-contract.ts";
import { CapacitySurveyArtifactIOError } from "./capacity/preflight-capacity-survey-io.ts";
import { PreflightArchivePathError } from "./preflight-archive-path.ts";
import { RevealFailureFrontierError } from "./reveal/failure-frontier/preflight-reveal-failure-frontier.ts";
import { classifyFailureFrontierReplay } from "./reveal/failure-frontier/preflight-reveal-failure-frontier-classification.ts";

describe("failure-frontier replay launch classification", () => {
  it("classifies only typed source, plan, packet, and identity rejection before replay", async () => {
    for (const error of [
      new SourceArtifactError("source"),
      new CapacitySurveyContractError("plan"),
      new CapacitySurveyArtifactIOError("plan IO"),
      new RevealFailureFrontierError("packet"),
      new PreflightCanaryError("identity"),
      new PreflightArchivePathError("path"),
    ]) {
      const replay = vi.fn(() => Promise.resolve("NOT_REPRODUCED" as const));
      await expect(
        classifyFailureFrontierReplay({
          validate: () => Promise.reject(error),
          replay,
        }),
      ).resolves.toBe("INVALID_PACKET");
      expect(replay).not.toHaveBeenCalled();
    }
  });

  it("propagates an infrastructure failure instead of converting it to a verdict", async () => {
    const infrastructure = new Error("Chromium unavailable");
    await expect(
      classifyFailureFrontierReplay({
        validate: () => Promise.reject(infrastructure),
        replay: () => Promise.resolve("NOT_REPRODUCED"),
      }),
    ).rejects.toBe(infrastructure);
  });
});
