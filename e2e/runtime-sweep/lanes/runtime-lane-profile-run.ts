import type { SeedProfile } from "../source/contracts.ts";
import { reconcileRuntimeProfileObservability } from "./observability/runtime-profile-observability.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "./runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "./runtime-lane-run-identity.ts";
import type { RuntimeObservabilityConfig } from "./runtime-observability-readiness.ts";

const throwIfRejected = (outcome: PromiseSettledResult<void>): void => {
  if (outcome.status === "fulfilled") return;
  const reason: unknown = outcome.reason;
  if (reason instanceof Error) throw reason;
  if (reason === undefined) {
    throw new Error("Runtime lane profile rejected without a reason");
  }
  const description =
    typeof reason === "string" ||
    typeof reason === "number" ||
    typeof reason === "bigint" ||
    typeof reason === "boolean"
      ? String(reason)
      : reason === null
        ? "null"
        : "unknown non-Error reason";
  throw new Error(`Runtime lane profile rejected with ${description}`);
};

export async function runRuntimeLaneProfile(
  input: Readonly<{
    readonly lane: RuntimeLane;
    readonly profile: SeedProfile;
    readonly assignment: RuntimeLaneAssignment;
    readonly run: RuntimeLaneRunIdentity;
    readonly observability: RuntimeObservabilityConfig;
    readonly execute: (startedAt: string) => Promise<void>;
    readonly abortExecution: (reason: unknown) => void;
  }>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  const [execution] = await Promise.allSettled([
    Promise.resolve().then(() => input.execute(startedAt)),
  ]);
  if (execution.status === "rejected") {
    input.abortExecution(execution.reason);
  }
  const endedAt = new Date().toISOString();
  const [telemetry] = await Promise.allSettled([
    reconcileRuntimeProfileObservability({
      lane: input.lane,
      profile: input.profile,
      assignment: input.assignment,
      run: input.run,
      startedAt,
      endedAt,
      observability: input.observability,
    }),
  ]);
  throwIfRejected(execution);
  throwIfRejected(telemetry);
}

export async function runRuntimeLaneProfiles(
  input: Readonly<{
    readonly lane: RuntimeLane;
    readonly assignment: RuntimeLaneAssignment;
    readonly run: RuntimeLaneRunIdentity;
    readonly observability: RuntimeObservabilityConfig;
    readonly abort: AbortSignal;
    readonly abortExecution: (reason: unknown) => void;
    readonly execute: (
      profile: SeedProfile,
      startedAt: string,
    ) => Promise<void>;
  }>,
): Promise<void> {
  const profiles = [
    ...new Set(input.lane.groups.map(({ profile }) => profile)),
  ];
  for (const profile of profiles) {
    if (input.abort.aborted) throw input.abort.reason;
    await runRuntimeLaneProfile({
      lane: input.lane,
      profile,
      assignment: input.assignment,
      run: input.run,
      observability: input.observability,
      execute: (startedAt) => input.execute(profile, startedAt),
      abortExecution: input.abortExecution,
    });
  }
}
