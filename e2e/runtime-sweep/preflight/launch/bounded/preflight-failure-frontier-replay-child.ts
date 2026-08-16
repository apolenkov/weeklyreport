import {
  boundedPlaywrightArgs,
  runBoundedPlaywrightChild,
} from "./preflight-bounded-playwright-child.ts";

const STOP_GRACE_MS = 10_000;
const CONFIG_PATH =
  "../../e2e/runtime-sweep/preflight/playwright.failure-frontier-replay.config.ts";
const OPERATION_NAME = "Failure-frontier replay";

export const failureFrontierReplayPlaywrightArgs = (
  leadingArgs: readonly string[],
): readonly string[] => boundedPlaywrightArgs(leadingArgs, CONFIG_PATH);

export function runPreflightFailureFrontierReplayChild(input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly maxDurationMs: number;
  readonly terminationGraceMs?: number;
}): Promise<void> {
  return runBoundedPlaywrightChild({
    operationName: OPERATION_NAME,
    configPath: CONFIG_PATH,
    repoRoot: input.repoRoot,
    environment: input.environment,
    maxDurationMs: input.maxDurationMs,
    terminationGraceMs: input.terminationGraceMs ?? STOP_GRACE_MS,
  });
}
