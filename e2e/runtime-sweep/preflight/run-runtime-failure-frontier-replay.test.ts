import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapacitySurveyContractError } from "./capacity/preflight-capacity-survey-contract.ts";
import { CapacitySurveyArtifactIOError } from "./capacity/preflight-capacity-survey-io.ts";
import { makePlan } from "./capacity/preflight-capacity-survey-test-support.ts";
import { PreflightArchivePathError } from "./preflight-archive-path.ts";

vi.mock(
  "./capacity/preflight-capacity-survey-io.ts",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("./capacity/preflight-capacity-survey-io.ts")
    >()),
    readCapacitySurveyPlan: vi.fn(),
  }),
);
vi.mock("./launch/bounded/preflight-failure-frontier-replay-child.ts", () => ({
  runPreflightFailureFrontierReplayChild: vi.fn(),
}));

import { readCapacitySurveyPlan } from "./capacity/preflight-capacity-survey-io.ts";
import { runPreflightFailureFrontierReplayChild } from "./launch/bounded/preflight-failure-frontier-replay-child.ts";
import { runRuntimeFailureFrontierReplay } from "./run-runtime-failure-frontier-replay.ts";

const originalEnvironment = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, {
    E2E_DATABASE_URL: "postgresql://localhost/customreport_e2e",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
    RUNTIME_SWEEP_ARCHIVE: "/archive",
    RUNTIME_SWEEP_CAPACITY_SURVEY_PLAN:
      "/archive/survey/PREFLIGHT_CAPACITY_SURVEY_PLAN.json",
    RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS: "86400000",
  });
  vi.mocked(readCapacitySurveyPlan).mockResolvedValue(makePlan());
  vi.mocked(runPreflightFailureFrontierReplayChild).mockResolvedValue();
});

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

describe("failure-frontier replay exact-plan deadline", () => {
  it("emits INVALID_PACKET for typed plan and archive rejection without spawning", async () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      for (const error of [
        new CapacitySurveyContractError("invalid plan"),
        new CapacitySurveyArtifactIOError("missing plan"),
        new PreflightArchivePathError("invalid plan path"),
      ]) {
        vi.mocked(readCapacitySurveyPlan).mockRejectedValueOnce(error);
        await expect(
          runRuntimeFailureFrontierReplay(),
        ).resolves.toBeUndefined();
      }
      expect(write).toHaveBeenCalledTimes(3);
      expect(write).toHaveBeenCalledWith(
        `${JSON.stringify({ authority: "diagnostic-only", classification: "INVALID_PACKET" })}\n`,
      );
      expect(runPreflightFailureFrontierReplayChild).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
    }
  });

  it("preserves a generic plan filesystem failure by reference", async () => {
    const infrastructure = Object.assign(new Error("storage unavailable"), {
      code: "EIO",
    });
    vi.mocked(readCapacitySurveyPlan).mockRejectedValueOnce(infrastructure);

    await expect(runRuntimeFailureFrontierReplay()).rejects.toBe(
      infrastructure,
    );
    expect(runPreflightFailureFrontierReplayChild).not.toHaveBeenCalled();
  });

  it("refuses an operator duration larger than the immutable plan", async () => {
    await expect(runRuntimeFailureFrontierReplay()).rejects.toThrow(
      /must equal immutable plan maxDurationMs=60000/iu,
    );
    expect(runPreflightFailureFrontierReplayChild).not.toHaveBeenCalled();
  });

  it("passes only the exact plan duration to the bounded child", async () => {
    process.env.RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS = "60000";

    await runRuntimeFailureFrontierReplay();

    expect(runPreflightFailureFrontierReplayChild).toHaveBeenCalledOnce();
    const call = vi.mocked(runPreflightFailureFrontierReplayChild).mock
      .calls[0]?.[0];
    expect(call?.maxDurationMs).toBe(60_000);
    expect(
      call?.environment.RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS,
    ).toBe("60000");
  });
});
