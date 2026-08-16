import {
  type SourceArtifact,
  SourceArtifactError,
} from "../../../source/source-artifact.ts";
import { PreflightCanaryError } from "../../canary/preflight-canary.ts";
import {
  CapacitySurveyContractError,
  type CapacitySurveyPlan,
} from "../../capacity/preflight-capacity-survey-contract.ts";
import { CapacitySurveyArtifactIOError } from "../../capacity/preflight-capacity-survey-io.ts";
import { PreflightArchivePathError } from "../../preflight-archive-path.ts";
import { RevealFailureFrontierError } from "./preflight-reveal-failure-frontier-contract.ts";
import type { RevealFailureFrontierPacket } from "./preflight-reveal-failure-frontier-io.ts";
import type { RevealFailureFrontierReplayClassification } from "./preflight-reveal-failure-frontier-replay.ts";

export type FailureFrontierReplayClassification =
  "INVALID_PACKET" | RevealFailureFrontierReplayClassification;

export type ValidatedFailureFrontierReplay = Readonly<{
  readonly source: SourceArtifact;
  readonly plan: CapacitySurveyPlan;
  readonly packet: RevealFailureFrontierPacket;
}>;

export const isFailureFrontierInvalidPacketError = (error: unknown): boolean =>
  error instanceof SourceArtifactError ||
  error instanceof CapacitySurveyContractError ||
  error instanceof CapacitySurveyArtifactIOError ||
  error instanceof RevealFailureFrontierError ||
  error instanceof PreflightCanaryError ||
  error instanceof PreflightArchivePathError;

export const emitFailureFrontierReplayClassification = (
  classification: FailureFrontierReplayClassification,
): void => {
  process.stdout.write(
    `${JSON.stringify({ authority: "diagnostic-only", classification })}\n`,
  );
};

export const classifyFailureFrontierReplay = async (input: {
  readonly validate: () => Promise<ValidatedFailureFrontierReplay>;
  readonly replay: (
    validated: ValidatedFailureFrontierReplay,
  ) => Promise<RevealFailureFrontierReplayClassification>;
}): Promise<FailureFrontierReplayClassification> => {
  const validation = await input.validate().then(
    (validated) => ({ kind: "valid", validated }) as const,
    (error: unknown) => {
      if (isFailureFrontierInvalidPacketError(error))
        return { kind: "invalid" } as const;
      throw error;
    },
  );
  if (validation.kind === "invalid") return "INVALID_PACKET";
  return input.replay(validation.validated);
};
