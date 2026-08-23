import { runGitCommand } from "../../source/manifest-source.ts";

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const ACTIVE_RUNTIME_OUTPUT =
  /^\?\? apps\/web\/\.next-runtime-(?:preflight|sweep)-\d+\/$/u;
const SOURCE_MONITOR_INTERVAL_MS = 1000;

export type RuntimeLaneSourceCommand = (
  args: readonly string[],
  cwd: string,
) => Promise<string>;

const runGit: RuntimeLaneSourceCommand = runGitCommand;

const assertSourceSha = async (
  input: Readonly<{ repoRoot: string; sourceSha: string }>,
  runCommand: RuntimeLaneSourceCommand,
): Promise<void> => {
  const head = (
    await runCommand(["rev-parse", "--verify", "HEAD"], input.repoRoot)
  ).trim();
  if (!SOURCE_SHA_PATTERN.test(head))
    throw new Error("Runtime lane source HEAD is not a full lowercase SHA");
  if (head !== input.sourceSha)
    throw new Error(
      `Runtime lane source SHA ${input.sourceSha} does not match HEAD ${head}`,
    );
};

export async function assertRuntimeLaneSource(
  input: Readonly<{
    repoRoot: string;
    sourceSha: string;
  }>,
  runCommand: RuntimeLaneSourceCommand = runGit,
): Promise<void> {
  const status = await runCommand(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    input.repoRoot,
  );
  if (status.trim() !== "")
    throw new Error("Runtime lane source worktree is not clean");

  await assertSourceSha(input, runCommand);
}

const assertRuntimeLaneSourceActive = async (
  input: Readonly<{ repoRoot: string; sourceSha: string }>,
  runCommand: RuntimeLaneSourceCommand,
): Promise<void> => {
  const status = await runCommand(
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    input.repoRoot,
  );
  const drift = status
    .split("\n")
    .filter((line) => line !== "" && !ACTIVE_RUNTIME_OUTPUT.test(line));
  if (drift.length > 0)
    throw new Error(
      `Runtime lane source drifted during execution: ${drift.join(", ")}`,
    );
  await assertSourceSha(input, runCommand);
};

const delay = (milliseconds: number): Promise<true> =>
  new Promise((resolve) => setTimeout(() => resolve(true), milliseconds));

export interface RuntimeLaneSourceMonitor {
  readonly stop: () => Promise<void>;
}

export const startRuntimeLaneSourceMonitor = (
  input: Readonly<{
    repoRoot: string;
    sourceSha: string;
    onDrift: (error: Error) => void;
  }>,
  runCommand: RuntimeLaneSourceCommand = runGit,
  intervalMs = SOURCE_MONITOR_INTERVAL_MS,
): RuntimeLaneSourceMonitor => {
  const stopSignal = Promise.withResolvers<false>();
  const monitor = async (): Promise<void> => {
    try {
      await assertRuntimeLaneSourceActive(input, runCommand);
    } catch (error: unknown) {
      const failure =
        error instanceof Error
          ? error
          : new Error("Runtime lane source monitor failed");
      input.onDrift(failure);
      throw failure;
    }
    const continueMonitoring = await Promise.race([
      delay(intervalMs),
      stopSignal.promise,
    ]);
    if (!continueMonitoring) return;
    return monitor();
  };
  const completion = monitor();
  void completion.catch(() => undefined);
  return {
    async stop() {
      stopSignal.resolve(false);
      await completion;
    },
  };
};
