import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export type RuntimeLaneSourceCommand = (
  args: readonly string[],
  cwd: string,
) => Promise<string>;

const runGit: RuntimeLaneSourceCommand = async (args, cwd) => {
  const result = await execFileAsync("git", [...args], { cwd });
  return result.stdout;
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

  const head = (
    await runCommand(["rev-parse", "--verify", "HEAD"], input.repoRoot)
  ).trim();
  if (!SOURCE_SHA_PATTERN.test(head))
    throw new Error("Runtime lane source HEAD is not a full lowercase SHA");
  if (head !== input.sourceSha)
    throw new Error(
      `Runtime lane source SHA ${input.sourceSha} does not match HEAD ${head}`,
    );
}
